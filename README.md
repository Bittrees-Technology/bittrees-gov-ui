# bittrees-gov-ui

Web UI for gov.bittrees.org

## Contracts

- BGOV (erc-1155 on Goerli): <https://goerli.etherscan.io/address/0x81Ed0A98c0BD6A75240fD4F65E5e2c43d7b343D9#internaltx>
- BTREE (erc-20 on goerli): https://goerli.etherscan.io/address/0x1Ca23BB7dca2BEa5F57552AE99C3A44fA7307B5f#code
- BTREE (erc-20 on mainnet): https://etherscan.io/address/0x6bDdE71Cf0C751EB6d5EdB8418e43D3d9427e436

For BTREE allowance methods, `owner` is the connected wallet and `spender` is the BGOV contract.

## Run site locally

    yarn

    # run locally against contract on Goerli
    REACT_APP_ENABLE_TESTNETS=true yarn start
