import { useQuery } from "@tanstack/react-query";
import { createPublicClient, http, getAddress, type Address } from "viem";
import { mainnet } from "viem/chains";

/**
 * Safe membership reads for the ENS-subname community rooms. A room tied to a
 * Safe admits that Safe's **signers** (on-chain owners) and **proposers**
 * (off-chain delegates from the Safe Transaction Service). Owners are
 * authoritative; delegates are best-effort (the service is public, no key).
 */

const SAFE_TX_SERVICE = "https://safe-transaction-mainnet.safe.global";
const RPC = import.meta.env.VITE_MAINNET_RPC_URL as string | undefined;
const client = createPublicClient({ chain: mainnet, transport: http(RPC) });

const SAFE_ABI = [
  { name: "getOwners", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address[]" }] },
] as const;

export async function fetchSafeOwners(safe: Address): Promise<string[]> {
  try {
    const owners = await client.readContract({ address: safe, abi: SAFE_ABI, functionName: "getOwners" });
    return (owners as readonly string[]).map((o) => o.toLowerCase());
  } catch {
    return [];
  }
}

export async function fetchSafeDelegates(safe: Address): Promise<string[]> {
  try {
    const r = await fetch(`${SAFE_TX_SERVICE}/api/v2/delegates/?safe=${getAddress(safe)}`, {
      headers: { accept: "application/json" },
    });
    if (!r.ok) return [];
    const j = await r.json();
    return ((j?.results ?? []) as Array<{ delegate?: string }>)
      .map((d) => String(d.delegate || "").toLowerCase())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export type SafeRole = "signer" | "proposer" | null;

/** Whether `user` may access a Safe-gated room (a signer or a proposer). */
export function useSafeAccess(safe: Address | undefined, user: string | undefined) {
  return useQuery({
    queryKey: ["safe-access", safe, user?.toLowerCase()],
    enabled: !!safe && !!user,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<{ role: SafeRole; eligible: boolean }> => {
      const u = (user as string).toLowerCase();
      const [owners, delegates] = await Promise.all([
        fetchSafeOwners(safe as Address),
        fetchSafeDelegates(safe as Address),
      ]);
      const role: SafeRole = owners.includes(u) ? "signer" : delegates.includes(u) ? "proposer" : null;
      return { role, eligible: role !== null };
    },
  });
}
