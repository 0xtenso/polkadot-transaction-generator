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
    console.log('Node version:', await this.api.rpc.system.version());
  }

  // Generate Balance Transfer Transaction
  async generateTransferTransaction(fromMnemonic, toAddress, amount) {
    const sender = this.keyring.addFromMnemonic(fromMnemonic);
    
    // Create transfer extrinsic
    const transfer = this.api.tx.balances.transferKeepAlive(toAddress, amount);
    
    // Get transaction info
    const info = await transfer.paymentInfo(sender);
    
    return {
      type: 'transfer',
      from: sender.address,
      to: toAddress,
      amount: amount.toString(),
      estimatedFee: info.partialFee.toString(),
      weight: info.weight.toString(),
      transaction: transfer,
      // Sign the transaction
      signAndSend: async () => {
        return await transfer.signAndSend(sender);
      }
    };
  }

  // Generate Staking Transaction
  async generateStakingTransaction(fromMnemonic, validatorAddress, amount) {
    const sender = this.keyring.addFromMnemonic(fromMnemonic);
    
    // Create staking extrinsic
    const stake = this.api.tx.staking.bond(validatorAddress, amount, 'Staked');
    
    const info = await stake.paymentInfo(sender);
    
    return {
      type: 'staking',
      from: sender.address,
      validator: validatorAddress,
      amount: amount.toString(),
      estimatedFee: info.partialFee.toString(),
      transaction: stake,
      signAndSend: async () => {
        return await stake.signAndSend(sender);
      }
    };
  }

  // Generate Democracy Vote Transaction
  async generateVoteTransaction(fromMnemonic, proposalIndex, vote) {
    const sender = this.keyring.addFromMnemonic(fromMnemonic);
    
    // Create vote extrinsic
    const voteExtrinsic = this.api.tx.democracy.vote(proposalIndex, vote);
    
    const info = await voteExtrinsic.paymentInfo(sender);
    
    return {
      type: 'democracy_vote',
      from: sender.address,
      proposalIndex,
      vote: vote.toString(),
      estimatedFee: info.partialFee.toString(),
      transaction: voteExtrinsic,
      signAndSend: async () => {
        return await voteExtrinsic.signAndSend(sender);
      }
    };
  }

  // Generate Batch Transaction
  async generateBatchTransaction(fromMnemonic, transactions) {
    const sender = this.keyring.addFromMnemonic(fromMnemonic);
    
    // Create batch extrinsic
    const batchTx = this.api.tx.utility.batch(transactions);
    
    const info = await batchTx.paymentInfo(sender);
    
    return {
      type: 'batch',
      from: sender.address,
      transactionCount: transactions.length,
      estimatedFee: info.partialFee.toString(),
      transaction: batchTx,
      signAndSend: async () => {
        return await batchTx.signAndSend(sender);
      }
    };
  }

  // Generate XCM Transaction (Cross-chain)
  async generateXCMTransaction(fromMnemonic, destinationChain, beneficiary, amount) {
    const sender = this.keyring.addFromMnemonic(fromMnemonic);
    
    // Create XCM transfer
    const xcmTransfer = this.api.tx.xcmPallet.reserveTransferAssets(
      destinationChain,
      beneficiary,
      [{ id: { Concrete: { parents: 0, interior: 'Here' } }, fun: { Fungible: amount } }],
      0
    );
    
    const info = await xcmTransfer.paymentInfo(sender);
    
    return {
      type: 'xcm_transfer',
      from: sender.address,
      destinationChain,
      beneficiary,
      amount: amount.toString(),
      estimatedFee: info.partialFee.toString(),
      transaction: xcmTransfer,
      signAndSend: async () => {
        return await xcmTransfer.signAndSend(sender);
      }
    };
  }

  // Get Account Information
  async getAccountInfo(address) {
    const accountInfo = await this.api.query.system.account(address);
    return {
      address,
      balance: {
        free: accountInfo.data.free.toString(),
        reserved: accountInfo.data.reserved.toString(),
        frozen: accountInfo.data.frozen.toString()
      },
      nonce: accountInfo.nonce.toString()
    };
  }

  // Monitor Transaction Status
  async monitorTransaction(txHash) {
    return new Promise((resolve, reject) => {
      let unsubscribe;
      
      this.api.rpc.chain.subscribeFinalisedHeads(async (header) => {
        const blockHash = header.hash;
        const blockNumber = header.number;
        
        // Check if transaction is in this block
        const block = await this.api.rpc.chain.getBlock(blockHash);
        const txInBlock = block.block.extrinsics.find(ext => 
          ext.hash.toString() === txHash
        );
        
        if (txInBlock) {
          console.log(`Transaction ${txHash} included in block ${blockNumber}`);
          unsubscribe();
          resolve({
            blockNumber: blockNumber.toString(),
            blockHash: blockHash.toString(),
            txHash
          });
        }
      }).then(unsub => {
        unsubscribe = unsub;
      }).catch(reject);
    });
  }

  async disconnect() {
    if (this.api) {
      await this.api.disconnect();
    }
  }
}

// Example Usage
async function example() {
  const generator = new PolkadotTransactionGenerator();
  
  try {
    // Initialize connection
    await generator.initialize();
    
    // Example mnemonic (DO NOT use in production)
    const testMnemonic = 'bottom drive obey lake curtain smoke basket hold race lonely fit walk';
    
    // Generate different types of transactions
    const transferTx = await generator.generateTransferTransaction(
      testMnemonic,
      '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', // Alice
      10000000000 // 1 DOT (10^10 planck)
    );
    
    console.log('Transfer Transaction:', {
      type: transferTx.type,
      from: transferTx.from,
      to: transferTx.to,
      amount: transferTx.amount,
      estimatedFee: transferTx.estimatedFee
    });
    
    // Get account info
    const accountInfo = await generator.getAccountInfo(transferTx.from);
    console.log('Account Info:', accountInfo);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await generator.disconnect();
  }
}

module.exports = { PolkadotTransactionGenerator, example };

// Run example if this file is executed directly
if (require.main === module) {
  example();
} 