import { useEffect, useState } from "react";
import { useContractReads, Address } from "wagmi";
import btreeAbi from "./abi-btree.json";
import { ethers } from "ethers";

export function useBtreeInformation({
  walletAddress,
  CONTRACT_ADDRESS,
  BTREE_CONTRACT_ADDRESS,
}: {
  walletAddress: Address | undefined;
  CONTRACT_ADDRESS: Address;
  BTREE_CONTRACT_ADDRESS: Address;
}) {
  const [btreeAllowance, setBtreeAllowance] = useState<bigint>(BigInt(0));
  const [btreeBalance, setBtreeBalance] = useState<bigint>(BigInt(0));

  const { data: btreeData, isLoading: btreeIsLoading } = useContractReads({
    contracts: [
      {
        address: BTREE_CONTRACT_ADDRESS,
        abi: btreeAbi,
        functionName: "allowance",
        args: [walletAddress, CONTRACT_ADDRESS],
      },
      {
        address: BTREE_CONTRACT_ADDRESS,
        abi: btreeAbi,
        functionName: "balanceOf",
        args: [walletAddress],
      },
    ],
  });

  useEffect(() => {
    console.log({btreeData})
    if (btreeData && btreeData[0]) {
      setBtreeAllowance(ethers.BigNumber.from(btreeData[0]).toBigInt());
    }

    if (btreeData && btreeData[1]) {
        setBtreeBalance(ethers.BigNumber.from(btreeData[0]).toBigInt());
      }
}, [btreeData]);

  return { btreeAllowance, btreeBalance, btreeIsLoading };
}
