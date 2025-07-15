# Polkadot Transaction Generator

A comprehensive tool for generating and managing various types of Polkadot transactions using the `@polkadot/api` library.

## Transaction Types in Polkadot

### 1. Extrinsics (Transactions)
Polkadot uses "extrinsics" as the general term for transactions and other state changes:

- Signed Extrinsics: Regular transactions from user accounts
- Unsigned Extrinsics: System-level operations (inherents)
- Inherents: Block production data (timestamps, etc.)

### 2. Core Transaction Properties

```javascript
Transaction Structure:
{
  signature: Option<Signature>,     // Cryptographic signature
  address: Option<AccountId>,       // Sender's account
  call: RuntimeCall,               // The actual operation
  extra: {
    nonce: u32,                   // Sequential counter
    tip: Balance,                 // Optional tip for priority
    asset_id: Option<AssetId>     // Asset for fee payment
  }
}
```

### 3. Fee Mechanism
- Weight-based: Uses computational weight instead of gas
- Base Fee: Fixed cost for transaction inclusion
- Weight Fee: Variable based on computational complexity
- Length Fee: Based on transaction size in bytes
- Tip: Optional priority fee

## Supported Transaction Types

### Balance Transfers
- `transferKeepAlive`: Transfer while keeping account alive
- `transfer`: Standard transfer (may kill account)
- `transferAll`: Transfer entire balance

### Staking Operations
- `bond`: Lock tokens for staking
- `bondExtra`: Add more stake
- `unbond`: Unlock staking tokens
- `nominate`: Choose validators to support

### Governance
- `vote`: Vote on democracy proposals
- `propose`: Submit new proposals
- `second`: Second existing proposals

### Utility Functions
- `batch`: Execute multiple transactions atomically
- `batchAll`: Like batch but fails if any sub-transaction fails
- `asMulti`: Multi-signature transactions

### Cross-Chain (XCM)
- `reserveTransferAssets`: Transfer assets to other parachains
- `teleportAssets`: Teleport assets (trusted chains)
- `limitedReserveTransferAssets`: Limited XCM transfers

## Installation & Setup

```bash
# Install dependencies
npm install

# Run the example
npm start
```

## Usage Examples

### Basic Transfer Transaction

```javascript
const { PolkadotTransactionGenerator } = require('./transaction-generator');

async function transferExample() {
  const generator = new PolkadotTransactionGenerator();
  await generator.initialize('wss://rpc.polkadot.io');
  
  const transferTx = await generator.generateTransferTransaction(
    'your mnemonic phrase here',
    '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', // recipient
    1000000000000 // 100 DOT (10^12 planck)
  );
  
  console.log('Transaction details:', transferTx);
  
  // To execute (uncomment next line)
  // const result = await transferTx.signAndSend();
  
  await generator.disconnect();
}
```

### Batch Transaction

```javascript
async function batchExample() {
  const generator = new PolkadotTransactionGenerator();
  await generator.initialize();
  
  // Create individual transactions
  const tx1 = generator.api.tx.balances.transferKeepAlive(recipient1, amount1);
  const tx2 = generator.api.tx.balances.transferKeepAlive(recipient2, amount2);
  
  const batchTx = await generator.generateBatchTransaction(
    'your mnemonic phrase',
    [tx1, tx2]
  );
  
  console.log('Batch transaction:', batchTx);
  await generator.disconnect();
}
```

### XCM Cross-Chain Transfer

```javascript
async function xcmExample() {
  const generator = new PolkadotTransactionGenerator();
  await generator.initialize();
  
  const xcmTx = await generator.generateXCMTransaction(
    'your mnemonic phrase',
    { V3: { parents: 1, interior: { X1: { Parachain: 1000 } } } }, // Statemint
    { V3: { parents: 0, interior: { X1: { AccountId32: { network: null, id: recipientId } } } } },
    1000000000000 // 100 DOT
  );
  
  console.log('XCM transaction:', xcmTx);
  await generator.disconnect();
}
```

## Transaction Monitoring

```javascript
// Monitor transaction status
const txHash = await transferTx.signAndSend();
const result = await generator.monitorTransaction(txHash);
console.log('Transaction finalized:', result);
```

## Account Management

```javascript
// Get account information
const accountInfo = await generator.getAccountInfo('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');
console.log('Balance:', accountInfo.balance.free);
console.log('Nonce:', accountInfo.nonce);
```

## Network Endpoints

### Mainnet
- Polkadot: `wss://rpc.polkadot.io`
- Kusama: `wss://kusama-rpc.polkadot.io`

### Testnets
- Westend: `wss://westend-rpc.polkadot.io`
- Paseo: `wss://paseo.rpc.amplicata.io`

### Parachains
- Statemint: `wss://statemint-rpc.polkadot.io`
- Acala: `wss://acala-rpc-0.aca-api.network`

## Transaction Fees

### Fee Calculation
```javascript
const info = await transaction.paymentInfo(sender);
console.log('Estimated fee:', info.partialFee.toString());
console.log('Weight:', info.weight.toString());
```

### Fee Components
- Base Fee: ~0.01 DOT fixed cost
- Weight Fee: Varies by complexity
- Length Fee: ~0.001 DOT per byte
- Tip: Optional priority fee

## Error Handling

Common transaction errors:
- `InsufficientBalance`: Not enough tokens
- `InvalidNonce`: Incorrect sequence number
- `BadOrigin`: Invalid transaction origin
- `ExtrinsicFailed`: Transaction execution failed

## Advanced Features

### Multi-Signature Transactions
```javascript
// Create multi-sig account
const multisig = generator.api.tx.multisig.asMulti(
  threshold,
  otherSignatories,
  maybeTimepoint,
  call,
  maxWeight
);
```

### Proxy Transactions
```javascript
// Execute via proxy
const proxyTx = generator.api.tx.proxy.proxy(
  realAccount,
  forceProxyType,
  call
);
```

## Documentation References

Based on the [Polkadot Documentation](https://docs.polkadot.com/):
- [Parachain Transactions](https://docs.polkadot.com/develop/parachain-basics/blocks-transactions-fees/)
- [Smart Contract Transactions](https://docs.polkadot.com/develop/smart-contracts/blocks-transactions-fees/)
- [XCM Interoperability](https://docs.polkadot.com/develop/interoperability/)