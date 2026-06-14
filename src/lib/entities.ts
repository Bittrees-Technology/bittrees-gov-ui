import type { Address } from "viem";

export type EntityKind = "treasury";

export interface BittreesEntity {
  address: Address;
  label: string;
  kind: EntityKind;
  /** Verified ENS name for this entity (mainnet). */
  ens?: string;
}

/**
 * The on-chain Safes shown on the Structure page: Bittrees, Inc. (the BGOV-governed
 * entity), its three B.T.C. subDAOs, and the two independent organizations
 * (Capital, Research). Each entity's description + avatar are read live from ENS.
 */
export const ENTITIES: BittreesEntity[] = [
  { address: "0xa657a18cAaFBdb58536B8Ce366A570CD3dbCAc61", label: "Bittrees, Inc.", kind: "treasury", ens: "gov.bittrees.eth" },
  { address: "0x6e4063a6481ab48FED6eeEBceA440d3bFe1e5Dcd", label: "Bittrees Capital", kind: "treasury", ens: "capital.bittrees.eth" },
  { address: "0x2F8f86e6E1Ff118861BEB7E583DE90f0449A264f", label: "Bittrees Research", kind: "treasury", ens: "research.bittrees.eth" },
  { address: "0xcB5E2626033126530e7157deD0DA04Ede46d3a25", label: "Business subDAO Safe", kind: "treasury", ens: "business.gov.bittrees.eth" },
  { address: "0x2CB5C7bd24480C9D450eD07eb49F4525ee41083a", label: "Technology subDAO Safe", kind: "treasury", ens: "technology.gov.bittrees.eth" },
  { address: "0xA9a4660f9c12CA2E8E6Af4c4E6Ed9a63dE95e6Ca", label: "Community subDAO Safe", kind: "treasury", ens: "community.gov.bittrees.eth" },
];

/**
 * Curated fallback descriptions per entity, shown on the Structure page only
 * when the entity's ENS `description` text record is unset. The live ENS record
 * always wins. subDAO descriptions are verbatim from the Bittrees wiki
 * (bittrees.eth.limo); Capital + Research are independent of Bittrees, Inc.
 */
export const ENTITY_BLURBS: Record<string, string> = {
  "gov.bittrees.eth":
    "Bittrees, Inc. is a metaverse company deploying and growing technology in the digital space. It is governed by BGOV common-stock holders, organized as the B.T.C. Group — the Business, Technology, and Community subDAOs — each holding one-third of voting power, with a two-thirds consensus for major matters.",
  "business.gov.bittrees.eth":
    "We AUTOMATE business processes with blockchain technology — for greater ease of use, more accurate record-keeping, and an unmatched level of transparency and security.",
  "technology.gov.bittrees.eth":
    "We DEVELOP scalable solutions designed to overcome challenges in both the real world and emerging virtual worlds in the metaverse. Our focus is on governance structures for non-fungible and fungible tokens.",
  "community.gov.bittrees.eth":
    "We BUILD strategies that capitalize on the unique characteristics of the metaverse. Our focus is fostering connections between people as we aim to ease the mechanisms that contribute to the flourishment of any community.",
  "capital.bittrees.eth":
    "Bittrees Capital stewards treasury, token, and liquidity operations. It is part of the Bittrees family but governed independently of Bittrees, Inc. — BGOV does not control it.",
  "research.bittrees.eth":
    "Bittrees Research promotes research in emerging technologies and systems innovation, creating new knowledge and tools with positive impact in the metaverse and beyond. It is governed independently of Bittrees, Inc. — BGOV does not control it.",
};
