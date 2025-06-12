# Smart Contract Debugger

A frontend application built with **Next.js** to simplify **debugging**, **interactive documentation**, and **manual interaction** with smart contracts — inspired by Swagger, but tailored for Solidity contracts.

## Features

- Load smart contracts via JSON containing the ABI and address
- Automatically generates an interaction interface based on the ABI
- Supports both `read` and `write` calls
- Compatible with browser wallets (e.g., MetaMask)
- Allows private key input for local network testing
- Works as functional and interactive contract documentation

---

## Technologies

- [Next.js](https://nextjs.org/)
- [Viem](https://viem.sh/)
- [Ethers.js](https://docs.ethers.org/)
- [Tailwind CSS](https://tailwindcss.com/) *(if applicable)*

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/gabgmont/smart-contract-debugger
cd smart-contract-debugger
```

### 2. Install dependencies

```bash
npm install
# or
yarn install
```

### 3. Run the project

```bash
npm run dev
# or
yarn dev
```

### 🔗 Net setup (chains)
The project comes pre-configured with support for the following networks:

- Anvil (localhost)
- Sepolia (testnet)

You can modify or add networks by editing the chains object in the main page file:

```bash
src/app/page.tsx
```

The chains used are those provided by the Viem library.

### 📄 Adding more contracts
To enable the contracts on the interface:

1. Create a JSON file on the folder public/contracts/
2. The file  must have the following properties:

```json
{
  "address": "0x1234567890abcdef...",
  "abi": [ ... ]
}
```
The file name will be used as the identifier on the interface, so it is recommended to name the file using the kebab-case pattern `(xxx-xxx.ext)`, for the parse to be done correctly, and show a pretty name on the dropdown.

### 🔐 Connection Methods
You can interact with the contracts in two ways:

1. Using injected wallets (Ex: MetaMask)
    - Select the network matching the contract;
    - Select the contract you wish to load;
    - Click on **Browser Wallet** at the Wallet Connection option;
    - Click **Connect** button;
    - Accept the wallet request to connect.
<br>
2. Using a Private Key
    - Select the network matching the contract;
    - Select the contract you wish to load;
    - Click on **Private Key** at the Wallet Connection option;
    - Enter a test private key into the designated field
    - Click **Connect** button;
<br>    
    ```json
    - Best suited for use with local networks like Anvil 
    - The private key never leaves the browser
    ```

Once connected, the UI will display all public functions of the contract with input fields for parameters, allowing easy execution of read calls and on-chain transactions.
