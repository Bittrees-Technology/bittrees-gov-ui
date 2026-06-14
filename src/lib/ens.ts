import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { normalize } from "viem/ens";

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
