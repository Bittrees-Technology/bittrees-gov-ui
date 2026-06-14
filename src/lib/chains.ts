import { http } from "wagmi";
import { mainnet, base } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

/**
 * Wallet/RPC config for the Bittrees, Inc. governance app.
 *
 * Mainnet ONLY (chainId 1). The wallet is used for Snapshot voting; on-chain
 * reads are light (ENS, the occasional balance), so this stays gentle on the RPC.
 */

const DUMMY_IDS = new Set([
  "",
  "00000000000000000000000000000001",
  "YOUR_WALLETCONNECT_PROJECT_ID",
]);

const rawProjectId =
  (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string) ?? "";

/** True when VITE_WALLETCONNECT_PROJECT_ID is missing, placeholder, or the all-zeros dummy. */
export const walletConnectMisconfigured: boolean = DUMMY_IDS.has(
  rawProjectId.trim()
);

if (walletConnectMisconfigured) {
  console.warn(
    "[bittrees-gov] VITE_WALLETCONNECT_PROJECT_ID is missing or set to a placeholder. " +
      "WalletConnect wallets will not work. Injected wallets (MetaMask, etc.) are unaffected."
  );
}

// Use a harmless placeholder so RainbowKit doesn't throw at init time. The
// ConfigBanner surfaces the misconfiguration to the user.
const projectId = walletConnectMisconfigured
  ? "00000000000000000000000000000001"
  : rawProjectId.trim();

// Full dedicated mainnet RPC URL (e.g. https://ethereum-rpc.publicnode.com or an
// Alchemy/Infura URL). Falls back to the public default transport when unset.
const mainnetRpc = import.meta.env.VITE_MAINNET_RPC_URL as string | undefined;

// JSON-RPC request batching: coalesce concurrent eth_calls — the swap router's
// ~15 parallel quoteExactInput probes, ENS lookups, etc. — into far fewer HTTP
// requests. App-wide RPC-request reduction; Alchemy and publicnode both support
// it. (wagmi's per-hook multicall batching is separate and still applies.)
const httpConfig = { batch: true } as const;

export const wagmiConfig = getDefaultConfig({
  appName: "Bittrees, Inc. Governance",
  projectId,
  // Mainnet for governance (BGOV voting, mint); Base carries the on-chain EAS
  // forum (cheap attestations). The wallet switches to Base only to post.
  chains: [mainnet, base],
  transports: {
    [mainnet.id]: mainnetRpc
      ? http(mainnetRpc, httpConfig)
      : http(undefined, httpConfig),
    [base.id]: http(undefined, httpConfig),
  },
  ssr: false,
});

/** The required chain for governance on-chain actions (voting, BGOV mint). */
export const REQUIRED_CHAIN_ID = mainnet.id; // 1

export { mainnet, base };
