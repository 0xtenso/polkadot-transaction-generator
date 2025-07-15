const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { cryptoWaitReady } = require('@polkadot/util-crypto');

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
   * Create a transfer transaction
   * @param {string} privateKey - Private key in hex format (0x...)
   * @param {string} toAddress - Recipient's wallet address
   * @param {string|number} amount - Amount to transfer in planck (smallest unit)
   * @returns {Object} Transaction object with details and send function
   */
  async createTransaction(privateKey, toAddress, amount) {
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
      
      return {
        from: sender.address,
        to: toAddress,
        amount: amount.toString(),
        estimatedFee: info.partialFee.toString(),
        
        // Send the transaction
        send: async () => {
          return new Promise((resolve, reject) => {
            transfer.signAndSend(sender, ({ status, events }) => {
              if (status.isInBlock) {
                console.log(`Transaction included in block: ${status.asInBlock}`);
                
                // Check for transaction success/failure
                const success = events.some(({ event }) => 
                  this.api.events.system.ExtrinsicSuccess.is(event)
                );
                
                if (success) {
                  resolve({
                    success: true,
                    blockHash: status.asInBlock.toString(),
                    txHash: transfer.hash.toString()
                  });
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
        }
      };
      
    } catch (error) {
      throw new Error(`Failed to create transaction: ${error.message}`);
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

// Simple usage example
async function example() {
  const generator = new PolkadotTransactionGenerator();
  
  try {
    // Initialize connection
    await generator.initialize('wss://westend-rpc.polkadot.io'); // Using testnet
    
    // Example private key (32 bytes hex) - DO NOT use in production
    const privateKey = '0x' + '0'.repeat(64); // Replace with actual private key
    const receiverAddress = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
    const amount = generator.dotToPlanck(1); // 1 DOT
    
    // Create transaction
    const transaction = await generator.createTransaction(
      privateKey,
      receiverAddress,
      amount
    );
    
    console.log('Transaction Details:');
    console.log(`From: ${transaction.from}`);
    console.log(`To: ${transaction.to}`);
    console.log(`Amount: ${generator.planckToDot(transaction.amount)} DOT`);
    console.log(`Estimated Fee: ${generator.planckToDot(transaction.estimatedFee)} DOT`);
    
    // Uncomment to send the transaction
    // const result = await transaction.send();
    // console.log('Transaction Result:', result);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await generator.disconnect();
  }
}

module.exports = { PolkadotTransactionGenerator };

// Run example if this file is executed directly
if (require.main === module) {
  example();
} 