import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { normalize } from "viem/ens";
import { mainnet } from "viem/chains";

/**
 * Live ENS text records for an entity. The org controls this copy on-chain
 * (set `description` / `url` / `com.twitter` on the ENS name) and the site
 * reflects it — so governance language stays in sync with the source of truth.
 */
export interface EnsText {
  description?: string;
  url?: string;
  twitter?: string;
  avatar?: string;
}

/**
 * Resolve ENS text records (`description`, `url`, `com.twitter`, `avatar`) for a
 * set of ENS names in one cached query. Each lookup is independent and failure
 * is swallowed per-name, so a single unresolved record never blanks the page.
 * Cached for an hour — these records change rarely and the reads are light.
 */
export function useEnsTexts(names: string[]) {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["ens-texts", ...[...names].sort()],
    enabled: !!client && names.length > 0,
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
    queryFn: async (): Promise<Record<string, EnsText>> => {
      const entries = await Promise.all(
        names.map(async (name): Promise<[string, EnsText]> => {
          try {
            const n = normalize(name);
            const [description, url, twitter, avatar] = await Promise.all([
              client!.getEnsText({ name: n, key: "description" }).catch(() => null),
              client!.getEnsText({ name: n, key: "url" }).catch(() => null),
              client!.getEnsText({ name: n, key: "com.twitter" }).catch(() => null),
              // getEnsAvatar resolves the record (NFT refs, ipfs://, URLs) to a
              // displayable image URL — so the site mirrors the ENS profile image.
              client!.getEnsAvatar({ name: n }).catch(() => null),
            ]);
            return [
              name,
              {
                description: description || undefined,
                url: url || undefined,
                twitter: twitter || undefined,
                avatar: avatar || undefined,
              },
            ];
          } catch {
            return [name, {}];
          }
        })
      );
      return Object.fromEntries(entries);
    },
  });
}

/**
 * Batch reverse-resolve a set of addresses → their primary ENS name (or null).
 * Always on mainnet (ENS lives there even when the wallet is on another chain).
 * Used to sort/label contacts: named addresses sort above raw 0x ones.
 */
export function useEnsNames(addresses: string[]) {
  const client = usePublicClient({ chainId: mainnet.id });
  const list = [...new Set(addresses.map((a) => a.toLowerCase()))].sort();
  return useQuery({
    queryKey: ["ens-names", ...list],
    enabled: !!client && list.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Record<string, string | null>> => {
      const entries = await Promise.all(
        list.map(async (a): Promise<[string, string | null]> => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const name = await (client as any).getEnsName({ address: a });
            return [a, name ?? null];
          } catch {
            return [a, null];
          }
        })
      );
      return Object.fromEntries(entries);
    },
  });
}

/* ── ENS .eth registration reads (for the Settings ENS tool) ─────────────────
   The actual mint (commit→reveal, real ETH) is handed off to the audited ENS app;
   here we only READ availability + price to show before the handoff. */
export const ETH_REGISTRAR_CONTROLLER = "0x253553366Da8546fC250F225fe3d25d0C782303b" as const;
export const YEAR_SECONDS = 31536000n;
export const ensAppUrl = (name: string) => `https://app.ens.domains/${encodeURIComponent(name)}`;

const CONTROLLER_ABI = [
  { type: "function", name: "available", stateMutability: "view", inputs: [{ name: "name", type: "string" }], outputs: [{ type: "bool" }] },
  {
    type: "function",
    name: "rentPrice",
    stateMutability: "view",
    inputs: [{ name: "name", type: "string" }, { name: "duration", type: "uint256" }],
    outputs: [{ type: "tuple", components: [{ name: "base", type: "uint256" }, { name: "premium", type: "uint256" }] }],
  },
] as const;

/** Strip a trailing .eth and lower-case → the registrable label. */
export const ensLabel = (name: string) => name.trim().toLowerCase().replace(/\.eth$/, "");

/** Is this 2nd-level .eth label available to register? */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ensAvailable(client: any, label: string): Promise<boolean> {
  return client.readContract({ address: ETH_REGISTRAR_CONTROLLER, abi: CONTROLLER_ABI, functionName: "available", args: [label] });
}

/** One-year registration price (base + premium) in wei. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ensYearPriceWei(client: any, label: string): Promise<bigint> {
  const p = (await client.readContract({ address: ETH_REGISTRAR_CONTROLLER, abi: CONTROLLER_ABI, functionName: "rentPrice", args: [label, YEAR_SECONDS] })) as { base: bigint; premium: bigint };
  return p.base + p.premium;
}
