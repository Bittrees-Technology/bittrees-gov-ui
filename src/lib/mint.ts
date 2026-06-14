import { useReadContracts } from "wagmi";
import type { Address } from "viem";
import { ERC20_ABI } from "./abis";

/**
 * BGOV (Bittrees common stock) public mint.
 *
 * Verified on-chain: BGOV is a TransparentUpgradeableProxy; minting is PUBLIC
 * (no role required — it reverts only at the payment step). A single share class
 * (tokenType 0) costs `mintPrice(0)` of the ERC-20 returned by `erc20Contract(0)`
 * (BTREE), with proceeds sent to `treasuryAddress(0)` (the Capital Safe). Mint is
 * `mint(tokenType, to, count)`; pay via a standard ERC-20 approve → mint.
 *
 * All economics are read LIVE from the contract — the constants below are only
 * fallbacks/defaults so the page renders before the reads resolve.
 */
export const BGOV_ADDRESS: Address = "0x6573248d7a8e18807cbbc6d574c9c21c044c84d1";
export const BTREE_ADDRESS: Address = "0x6bDdE71Cf0C751EB6d5EdB8418e43D3d9427e436";
export const CAPITAL_SAFE: Address = "0x6e4063a6481ab48FED6eeEBceA440d3bFe1e5Dcd";
export const BGOV_TOKEN_TYPE = 0; // single share class; types 1+ revert
export const BTREE_DECIMALS = 18;

export const BGOV_MINT_ABI = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_tokenType", type: "uint8" },
      { name: "to", type: "address" },
      { name: "mintCount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "mintPrice",
    stateMutability: "view",
    inputs: [{ name: "_tokenType", type: "uint8" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "erc20Contract",
    stateMutability: "view",
    inputs: [{ name: "_tokenType", type: "uint8" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "treasuryAddress",
    stateMutability: "view",
    inputs: [{ name: "_tokenType", type: "uint8" }],
    outputs: [{ type: "address" }],
  },
] as const;

export interface MintInfo {
  pricePerShare?: bigint; // in BTREE base units (18 dec)
  payToken: Address; // the ERC-20 accepted for payment (BTREE)
  treasury: Address; // where proceeds go (Capital Safe)
  isLoading: boolean;
}

/** Live mint economics for tokenType 0: price/share, payment token, treasury. */
export function useMintInfo(): MintInfo {
  const { data, isLoading } = useReadContracts({
    contracts: [
      { address: BGOV_ADDRESS, abi: BGOV_MINT_ABI, functionName: "mintPrice", args: [BGOV_TOKEN_TYPE] },
      { address: BGOV_ADDRESS, abi: BGOV_MINT_ABI, functionName: "erc20Contract", args: [BGOV_TOKEN_TYPE] },
      { address: BGOV_ADDRESS, abi: BGOV_MINT_ABI, functionName: "treasuryAddress", args: [BGOV_TOKEN_TYPE] },
    ],
    query: { staleTime: 5 * 60 * 1000 },
  });
  const [price, token, treasury] = data ?? [];
  return {
    pricePerShare: price?.result as bigint | undefined,
    payToken: (token?.result as Address | undefined) ?? BTREE_ADDRESS,
    treasury: (treasury?.result as Address | undefined) ?? CAPITAL_SAFE,
    isLoading,
  };
}

export interface BtreeState {
  balance?: bigint;
  allowance?: bigint;
  isLoading: boolean;
  refetch: () => void;
}

/** The connected wallet's BTREE balance + allowance granted to the BGOV contract. */
export function useBtreeState(account?: Address): BtreeState {
  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      { address: BTREE_ADDRESS, abi: ERC20_ABI, functionName: "balanceOf", args: [account!] },
      { address: BTREE_ADDRESS, abi: ERC20_ABI, functionName: "allowance", args: [account!, BGOV_ADDRESS] },
    ],
    query: { enabled: !!account, refetchInterval: 15_000 },
  });
  const [bal, alw] = data ?? [];
  return {
    balance: bal?.result as bigint | undefined,
    allowance: alw?.result as bigint | undefined,
    isLoading,
    refetch,
  };
}
