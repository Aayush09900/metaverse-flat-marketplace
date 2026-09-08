# Metaverse Flat Marketplace

A production-oriented Web3 property booking DApp for browsing and booking flats on the Ethereum Sepolia testnet.

## Features
- MetaMask wallet connection
- Sepolia network validation
- Live on-chain flat inventory
- Search and availability filters
- On-chain booking transactions with confirmation states
- FlatBooked event activity and Etherscan transaction links
- Wallet and contract balance visibility
- Responsive UI with loading, empty and error states
- GitHub Actions CI and GitHub Pages deployment

## Stack
- HTML, CSS, JavaScript
- ethers.js v6
- Parcel
- Solidity smart contract integration
- MetaMask
- Ethereum Sepolia

## Development
```bash
npm install
npm start
```

Production build:
```bash
npm run build
```

Validation:
```bash
npm run check
```

The frontend is configured for the deployed Sepolia contract in `src/config.js`. Never commit private keys or production secrets.

## Deployment
The repository includes GitHub Actions workflows for CI and GitHub Pages. Enable Pages with **GitHub Actions** as the source, then push to `main`.

## Production note
This repository is a staging/testnet DApp. Before handling real funds or production bookings, the smart contract should receive an independent security review, formal tests, monitoring, access-control review, and a production network deployment plan.
