const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { cryptoWaitReady } = require('@polkadot/util-crypto');
const readline = require('readline');

class PolkadotTransactionGenerator {
  constructor() {
    this.api = null;
    this.keyring = null;
  }

  async initialize(wsEndpoint = 'wss://rpc.polkadot.io') {
    // Wait for crypto libraries to be ready
    await cryptoWaitReady();
    
    // Create provider and API instance
    const provider = new WsProvider(wsEndpoint);
    this.api = await ApiPromise.create({ provider });
    
    // Initialize keyring
    this.keyring = new Keyring({ type: 'sr25519' });
    
    console.log('Connected to:', await this.api.rpc.system.chain());
  }

  /**
   * Create and send a transfer transaction
   * @param {string} privateKey - Private key in hex format (0x...)
   * @param {string} toAddress - Recipient's wallet address
   * @param {string|number} amount - Amount to transfer in planck (smallest unit)
   * @returns {Object} Transaction result
   */
  async sendTransaction(privateKey, toAddress, amount) {
    try {
      // Create keypair from private key
      const sender = this.keyring.addFromSeed(privateKey);
      
      // Validate recipient address
      if (!this.isValidAddress(toAddress)) {
        throw new Error('Invalid recipient address');
      }

      // Create transfer transaction
      const transfer = this.api.tx.balances.transferKeepAlive(toAddress, amount);
      
      // Get transaction fee estimation
      const info = await transfer.paymentInfo(sender);
      
      console.log('\nTransaction Details:');
      console.log(`From: ${sender.address}`);
      console.log(`To: ${toAddress}`);
      console.log(`Amount: ${this.planckToDot(amount)} DOT`);
      console.log(`Estimated Fee: ${this.planckToDot(info.partialFee)} DOT`);
      console.log('Sending transaction...\n');
      
      // Send the transaction
      return new Promise((resolve, reject) => {
        transfer.signAndSend(sender, ({ status, events }) => {
          if (status.isInBlock) {
            console.log(`Transaction included in block: ${status.asInBlock}`);
            
            // Check for transaction success/failure
            const success = events.some(({ event }) => 
              this.api.events.system.ExtrinsicSuccess.is(event)
            );
            
            if (success) {
              const result = {
                success: true,
                blockHash: status.asInBlock.toString(),
                txHash: transfer.hash.toString(),
                from: sender.address,
                to: toAddress,
                amount: this.planckToDot(amount) + ' DOT',
                fee: this.planckToDot(info.partialFee) + ' DOT'
              };
              resolve(result);
            } else {
              const errorEvent = events.find(({ event }) =>
                this.api.events.system.ExtrinsicFailed.is(event)
              );
              reject(new Error(`Transaction failed: ${errorEvent?.event?.data}`));
            }
          } else if (status.isFinalized) {
            console.log(`Transaction finalized: ${status.asFinalized}`);
          }
        }).catch(reject);
      });
      
    } catch (error) {
      throw new Error(`Failed to send transaction: ${error.message}`);
    }
  }

  /**
   * Validate Polkadot address format
   * @param {string} address 
   * @returns {boolean}
   */
  isValidAddress(address) {
    try {
      this.keyring.decodeAddress(address);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Convert DOT amount to planck (smallest unit)
   * @param {number} dotAmount - Amount in DOT
   * @returns {string} Amount in planck
   */
  dotToPlanck(dotAmount) {
    return (dotAmount * 1e12).toString();
  }

  /**
   * Convert planck to DOT
   * @param {string|number} planckAmount - Amount in planck
   * @returns {string} Amount in DOT
   */
  planckToDot(planckAmount) {
    return (Number(planckAmount) / 1e12).toFixed(6);
  }

  async disconnect() {
    if (this.api) {
      await this.api.disconnect();
    }
  }
}

// Terminal input helper functions
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

function askQuestion(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function getUserInputs() {
  const rl = createReadlineInterface();
  
  try {
    console.log('=== Polkadot Transaction Generator ===\n');
    
    // Get network choice
    console.log('Choose network:');
    console.log('1. Westend Testnet (recommended for testing)');
    console.log('2. Polkadot Mainnet (real DOT)');
    const networkChoice = await askQuestion(rl, 'Enter choice (1 or 2): ');
    
    const network = networkChoice === '2' 
      ? 'wss://rpc.polkadot.io' 
      : 'wss://westend-rpc.polkadot.io';
    
    // Get private key
    const privateKey = await askQuestion(rl, '\nEnter your private key (hex format with 0x prefix): ');
    
    // Get receiver address
    const receiverAddress = await askQuestion(rl, 'Enter receiver wallet address: ');
    
    // Get amount
    const amountStr = await askQuestion(rl, 'Enter amount to send (in DOT): ');
    const amount = parseFloat(amountStr);
    
    return {
      network,
      privateKey,
      receiverAddress,
      amount
    };
  } finally {
    rl.close();
  }
}

function validateInputs(privateKey, receiverAddress, amount) {
  const errors = [];
  
  // Validate private key format
  if (!privateKey.startsWith('0x') || privateKey.length !== 66) {
    errors.push('Private key must be in hex format (0x...) and 64 characters long');
  }
  
  // Validate amount
  if (isNaN(amount) || amount <= 0) {
    errors.push('Amount must be a positive number');
  }
  
  // Validate receiver address (basic check)
  if (!receiverAddress || receiverAddress.length < 40) {
    errors.push('Invalid receiver address format');
  }
  
  return errors;
}

async function executeTransaction() {
  const generator = new PolkadotTransactionGenerator();
  
  try {
    // Get user inputs from terminal
    const { network, privateKey, receiverAddress, amount } = await getUserInputs();
    
    // Validate inputs
    const validationErrors = validateInputs(privateKey, receiverAddress, amount);
    if (validationErrors.length > 0) {
      console.log('\nValidation Errors:');
      validationErrors.forEach(error => console.log(`- ${error}`));
      return;
    }
    
    // Initialize connection
    console.log('\nConnecting to network...');
    await generator.initialize(network);
    
    // Additional address validation using keyring
    if (!generator.isValidAddress(receiverAddress)) {
      throw new Error('Invalid receiver address format');
    }
    
    // Convert DOT to planck
    const amountInPlanck = generator.dotToPlanck(amount);
    
    console.log('Processing your transaction...');
    
    // Send the transaction
    const result = await generator.sendTransaction(
      privateKey,
      receiverAddress,
      amountInPlanck
    );
    
    console.log('\nTransaction Successful!');
    console.log('Final Result:');
    console.log(`Block Hash: ${result.blockHash}`);
    console.log(`TX Hash: ${result.txHash}`);
    console.log(`Amount Sent: ${result.amount}`);
    console.log(`Fee Paid: ${result.fee}`);
    
  } catch (error) {
    console.error('\nTransaction Failed:');
    console.error(`Error: ${error.message}`);
  } finally {
    await generator.disconnect();
    console.log('\nDisconnected from network');
  }
}

module.exports = { PolkadotTransactionGenerator, executeTransaction };

// Run transaction if this file is executed directly
if (require.main === module) {
  executeTransaction();
}