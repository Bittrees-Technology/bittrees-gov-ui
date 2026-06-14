import { useEnsName, useEnsAvatar } from "wagmi";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";
import { shortAddress } from "../lib/links";

/**
 * Shows an address as its ENS name (reverse-resolved on mainnet) when one is set,
 * falling back to the shortened 0x form. Pass `avatar` to show the ENS avatar.
 */
export function AddressName({ address, avatar = false }: { address?: string; avatar?: boolean }) {
  const addr = address as `0x${string}` | undefined;
  const { data: name } = useEnsName({ address: addr, chainId: mainnet.id, query: { enabled: !!addr } });
  const { data: img } = useEnsAvatar({ name: name ? normalize(name) : undefined, chainId: mainnet.id, query: { enabled: !!name && avatar } });
  if (!address) return null;
  const label = name || shortAddress(address);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", minWidth: 0 }} title={address}>
      {avatar && (
        img ? (
          <img src={img} alt="" width={18} height={18} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <span aria-hidden style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--color-bg-subtle)", border: "1px solid var(--color-border-light)", flexShrink: 0 }} />
        )
      )}
      <span style={{ fontFamily: name ? "var(--font-sans)" : "var(--font-mono)", fontSize: "0.82rem", color: "var(--color-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
    </span>
  );
}
