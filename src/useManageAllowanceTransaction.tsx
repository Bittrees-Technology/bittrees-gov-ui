import { useState, useEffect } from "react";
import {
  usePrepareContractWrite,
  useContractWrite,
  useWaitForTransaction,
  Address,
} from "wagmi";
import btreeAbi from "./abi-btree.json";

export function useManageAllowanceTransaction({
  BTREE_CONTRACT_ADDRESS,
  CONTRACT_ADDRESS,
  chainId,
  amount,
}: {
  BTREE_CONTRACT_ADDRESS: Address;
  CONTRACT_ADDRESS: Address;
  chainId: number;
  amount: bigint;
}) {
  const { config: configAllowance } = usePrepareContractWrite({
    address: BTREE_CONTRACT_ADDRESS,
    abi: btreeAbi,
    functionName: "increaseAllowance",
    chainId,
    args: [CONTRACT_ADDRESS, amount.toString()],
  });

  const [allowanceHash, setAllowanceHash] = useState<Address | undefined>();

  const { data: allowanceData, write: writeAllowance } =
    useContractWrite(configAllowance);

  useEffect(() => {
    if (allowanceData?.hash) {
      setAllowanceHash(allowanceData?.hash);
    }
  }, [allowanceData]);

  const { data: dataForAllowanceTransaction } = useWaitForTransaction({
    hash: allowanceHash,
    chainId,
    enabled: Boolean(allowanceHash),
  });

  useEffect(() => {
    console.log("useManageAllowanceTransaction: Successful", {
      dataForAllowanceTransaction,
    });
  }, [dataForAllowanceTransaction]);

  function sendAllowance() {
    if (amount <= BigInt(0)) return;
    writeAllowance?.();
  }

  return {
    sendAllowance,
    allowanceTransactionResult: dataForAllowanceTransaction,
  };
}
