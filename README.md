# bittrees-gov-ui

Web UI for gov.bittrees.org

## Contracts

Deployer wallet public key: 0x7435e7f3e6B5c656c33889a3d5EaFE1e17C033CD

- Proxy (mainnet): https://etherscan.io/address/0x6573248d7a8e18807cbbc6d574c9c21c044c84d1
- Proxy Admin (mainnet): https://etherscan.io/address/0xa4ec76dadc70104e1906260da1a7509d69315e56
- Contract (mainnet): https://etherscan.io/address/0xb715b1824fd05044f773a9f72e44d3ca0c123461

Testnet

- BGOV (erc-1155 on Goerli): <https://goerli.etherscan.io/address/0x81Ed0A98c0BD6A75240fD4F65E5e2c43d7b343D9#internaltx>

BTREE Contracts

- BTREE (erc-20 on goerli): https://goerli.etherscan.io/address/0x1Ca23BB7dca2BEa5F57552AE99C3A44fA7307B5f
- BTREE (erc-20 on mainnet): https://etherscan.io/address/0x6bDdE71Cf0C751EB6d5EdB8418e43D3d9427e436

For BTREE allowance methods, `owner` is the connected wallet and `spender` is the BGOV contract.

## Run site locally

    yarn

    # run locally against contract on Goerli
    REACT_APP_ENABLE_TESTNETS=true yarn start
