
import abi from "./abi.json";
import { ethers } from "ethers";
import { Alchemy, Network } from "alchemy-sdk";

export const CONTRACT_ADDRESS = "0xc8121e650bd797d8b9dad00227a9a77ef603a84a";
const RPC_URL = "https://eth-mainnet.g.alchemy.com/v2/g6X4-HRGshx5XNp7gpDxLPeX-WSpw9pN";

interface MyNFT {
    tokenId: string;
  }
  
  /**
   * Checks if a membership is expired on a single token.
   *
   * @param tokenId - hex string such as 0x01
   * @returns boolean
   */
  async function isMembershipExpired(tokenId: string): Promise<boolean> {
    try {
      const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, abi, provider);
      return await contract.isExpired(tokenId);
    } catch (err) {
      console.error("failure when calling contract.isExpired() due to", err);
    }
    return false;
  }
  
  /**
   * Gets all tokenIds for a given wallet address that are owned by the contract.
   *
   * @param ownerAddress - wallet address
   * @param contractAddress
   * @returns string[] - array of tokenIds
   */
  async function getMemberTokenIdsViaAlchemySDK(
    ownerAddress: string,
    contractAddress: string
  ): Promise<string[]> {  
    const settings = {
      apiKey: "g6X4-HRGshx5XNp7gpDxLPeX-WSpw9pN", 
      network: Network.ETH_MAINNET, 
    };
    const alchemy = new Alchemy(settings);
    const response = await alchemy.nft.getNftsForOwner( ownerAddress, { contractAddresses: [ contractAddress ] });
    const ownedNfts = response.ownedNfts as MyNFT[];
    return ownedNfts.map((nft) => {
      return nft.tokenId;
    });
  }
  
  /**
   * Checks if a wallet address has an active membership.
   *
   * @param ownerAddress
   * @returns boolean
   */
  export async function hasActiveMembership(ownerAddress: string): Promise<boolean> {
    //const tokenIds = await getMemberTokenIds(ownerAddress, CONTRACT_ADDRESS);
    const tokenIds = await getMemberTokenIdsViaAlchemySDK(ownerAddress, CONTRACT_ADDRESS);
    console.log("tokenId: " + tokenIds);
    const isExpired = await Promise.all(
      tokenIds.map((tokenId) => {
        return isMembershipExpired(tokenId);
      })
    );
    console.log("isExpired: " + isExpired);
    return isExpired.some((isExpired) => {
      return !isExpired;
    });
  }