import {
  useAccount,
  usePrepareContractWrite,
  useContractWrite,
  useContractRead,
} from "wagmi";
import abi from "./abi.json";
import btreeAbi from "./abi-btree.json";
import { goerli, mainnet } from "wagmi/chains";
import { useState, useEffect } from "react";
import { ethers } from "ethers";

const CONTRACT_ADDRESS = "0x81Ed0A98c0BD6A75240fD4F65E5e2c43d7b343D9";
const BTREE_CONTRACT_ADDRESS = "0x1Ca23BB7dca2BEa5F57552AE99C3A44fA7307B5f";

const chainId =
  process.env.REACT_APP_ENABLE_TESTNETS === "true" ? goerli.id : mainnet.id;

console.info(`Contract: ${CONTRACT_ADDRESS}`);
console.info(`Chain ID: ${chainId}`);

const mintPrice = "1000";

function displayFriendlyError(message: string | undefined): string {
  if (!message) return "";

  if (message.startsWith("insufficient funds for intrinsic transaction cost")) {
    return "insufficient funds for intrinsic transaction cost.";
  }

  if (message.includes("Insufficient allowance")) {
    return "insufficient allowance. This wallet hasn't granted permissions to the contract to transfer BTREE tokens.";
  }

  return message;
}

export function Mint() {
  const [mintCount, setMintcount] = useState(1);
  const [allowance, setAllowance] = useState<bigint>(BigInt(0));
  const [total, setTotal] = useState(mintPrice);

  function calcTotal(count: string) {
    setMintcount(parseInt(count, 10));
    const total = (
      parseInt(mintPrice, 10) * parseInt(count ? count : "0", 10)
    ).toFixed(0);
    setTotal(total);
  }

  const { address } = useAccount();

  const { config, error } = usePrepareContractWrite({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: "mint",
    chainId: chainId,
    args: [0x0, address, mintCount], // 0x0 is BTREE
  });
  const { isLoading, write } = useContractWrite(config);

  function onClick() {
    write?.();
  }

  const { data: allowanceData, isLoading: allowanceIsLoading } =
    useContractRead({
      address: BTREE_CONTRACT_ADDRESS,
      abi: btreeAbi,
      functionName: "allowance",
      args: [address, CONTRACT_ADDRESS],
    });

  useEffect(() => {
    if (allowanceData) {
      setAllowance(ethers.BigNumber.from(allowanceData).toBigInt());
    }
  }, [allowanceData]);

  return (
    <>
      <div className="grid grid-cols-2 gap-6 justify-start font-newtimesroman">
        <div className="text-right">Cost per BGOV token:</div>
        <div className="text-left">
          {parseInt(mintPrice, 10).toLocaleString()} BTREE
        </div>
        <div className="text-right">Number of tokens to mint:</div>
        <div className="text-left">
          <input
            className="w-20 input-sm"
            type="number"
            placeholder="1"
            onChange={(e) => calcTotal(e.target.value)}
            step="1"
            min="1"
          />
        </div>
        <div className="text-right">Total price:</div>
        <div className="text-left">
          {parseInt(total, 10).toLocaleString()} <span>BTREE</span>
        </div>
      </div>
      <p className="mt-2 font-newtimesroman">
        The allowance of BTREE you've granted for minting is{" "}
        {parseInt(ethers.utils.formatEther(allowance), 10).toLocaleString()}.
      </p>

      <div className="m-4 mt-8 mx-auto max-w-xl font-newtimesroman">
        <p className="text-xl">What's required for minting?</p>
        <p className="mt-2">
          To transfer BTREE tokens, you'll need ETH in your wallet. There will
          also be two transactions. The first to grant permissions for our
          contract to transfer BTREE tokens on your behalf, the second to do the
          transfer and mint your equity tokens.
        </p>
      </div>

      {error && (
        <div className="m-4 mx-auto max-w-xl font-newtimesroman font-bold text-lg text-red-500">
          An error occurred preparing the transaction:{" "}
          {displayFriendlyError(error.message)}
        </div>
      )}

      <div className="mt-4 font-newtimesroman">
        <button
          className="btn btn-primary"
          onClick={onClick}
          disabled={
            !Boolean(address) ||
            Boolean(error) ||
            Boolean(allowance >= BigInt(total))
          }
        >
          Mint
        </button>

        {!address && (
          <p className="text-2xl mt-4">Please connect your wallet.</p>
        )}
        {isLoading && <p className="text-2xl mt-4">Minting...</p>}
      </div>
    </>
  );
}
