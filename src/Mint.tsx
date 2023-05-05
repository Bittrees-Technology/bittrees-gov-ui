import { useAccount, usePrepareContractWrite, useContractWrite } from "wagmi";
import abi from "./abi.json";
import { goerli, mainnet } from "wagmi/chains";
import { ethers } from "ethers";
import { useState } from "react";

const CONTRACT_ADDRESS = "0xc8121e650bd797d8b9dad00227a9a77ef603a84a";
const chainId =
  process.env.REACT_APP_ENABLE_TESTNETS === "true" ? goerli.id : mainnet.id;

console.info(`Contract: ${CONTRACT_ADDRESS}`);
console.info(`Chain ID: ${chainId}`);

const mintPrice = "0.0250";

function displayFriendlyError(message: string | undefined): string {
  if (!message) return "";

  if (
    message.startsWith("insufficient funds for intrinsic transaction cost")
  ) {
    return "insufficient funds for intrinsic transaction cost.";
  }
  return message;
}

export function Mint() {
  const [total, setTotal] = useState(mintPrice);

  function calcTotal(donation: string) {
    const total = (
      parseFloat(mintPrice) + parseFloat(donation ? donation : "0")
    ).toFixed(4);
    setTotal(total);
  }

  const { address } = useAccount();

  const { config, error } = usePrepareContractWrite({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: "mintMembership",
    chainId: chainId,
    args: [address],
    overrides: { value: ethers.utils.parseEther(total) },
  });
  const { isLoading, write } = useContractWrite(config);

  function onClick() {
    write?.();
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-6 justify-start font-newtimesroman">
        <div className="text-right">Minimum Donation:</div>
        <div className="text-left">{mintPrice} ETH</div>
        <div className="text-right">Add additional donation:</div>
        <div className="text-left">
          <input
            className="w-20 input-sm"
            type="number"
            placeholder="0.00"
            onChange={(e) => calcTotal(e.target.value)}
            step="0.01"
            min="0"
          />{" "}
          <span>ETH</span>
        </div>
        <div className="text-right">Total price:</div>
        <div className="text-left">
          {total} <span>ETH</span>
        </div>
      </div>
      {error && (
        <div className="m-4 mx-auto max-w-xl font-newtimesroman">
          An error occurred preparing the transaction:{" "}
          {displayFriendlyError(error.message)}
        </div>
      )}

      <div className="mt-4 font-newtimesroman">
        <button
          className="btn btn-primary"
          onClick={onClick}
          disabled={!Boolean(address) || Boolean(error)}
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
