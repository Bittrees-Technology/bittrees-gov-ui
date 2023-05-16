import { useAccount, usePrepareContractWrite, useContractWrite } from "wagmi";
import abi from "./abi.json";
import {
  // goerli,
  mainnet,
} from "wagmi/chains";
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useBtreeInformation } from "./useBtreeInformation";
import { useManageAllowanceTransaction } from "./useManageAllowanceTransaction";

const CONTRACT_ADDRESS = "0x6573248d7a8e18807cbbc6d574c9c21c044c84d1";
const BTREE_CONTRACT_ADDRESS = "0x6bDdE71Cf0C751EB6d5EdB8418e43D3d9427e436";

// const chainId =
//   process.env.REACT_APP_ENABLE_TESTNETS === "true" ? goerli.id : mainnet.id;
const chainId = mainnet.id;

console.info(`BGOV contract: ${CONTRACT_ADDRESS}`);
console.info(`BTREE contract: ${BTREE_CONTRACT_ADDRESS}`);
console.info(`Chain ID: ${chainId}`);

const mintPrice = ethers.utils.parseUnits("1000.0", "ether").toBigInt();

// function displayFriendlyError(message: string | undefined): string {
//   if (!message) return "";

//   if (message.startsWith("insufficient funds for intrinsic transaction cost")) {
//     return "insufficient funds for intrinsic transaction cost.";
//   }

//   if (message.includes("Insufficient allowance")) {
//     return "insufficient allowance. This wallet hasn't granted permissions to the contract to transfer BTREE tokens.";
//   }

//   return message;
// }

enum MintState {
  NotConnected,
  AllowanceStep,
  AllowanceTransactionInProgress,
  MintStep,
  MintTransactionInProgress,
  MintComplete,
}

export function Mint() {
  const [mintCount, setMintcount] = useState(1);
  const [total, setTotal] = useState<bigint>(mintPrice);
  const { address } = useAccount();
  const [allowanceInProgress, setAllowanceInProgress] = useState(false);
  const [mintInProgress, setMintInProgress] = useState(false);
  const [mintComplete, setMintComplete] = useState(false);

  const { btreeAllowance, btreeBalance, btreeIsLoading } = useBtreeInformation({
    walletAddress: address,
    CONTRACT_ADDRESS,
    BTREE_CONTRACT_ADDRESS,
  });

  function calcTotal(count: string) {
    setMintcount(parseInt(count, 10));
    const totalEther = mintPrice * BigInt(parseInt(count ? count : "0", 10));
    setTotal(totalEther);
  }

  // const { config, error } = usePrepareContractWrite({
  const { config } = usePrepareContractWrite({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: "mint",
    chainId,
    args: [0x0, address, mintCount], // 0x0 is BTREE
  });
  const { write } = useContractWrite(config);

  function onClick() {
    setMintInProgress(true);
    write?.();
    window.setTimeout(() => {
      setMintComplete(true);
    }, 10000);
  }

  const { sendAllowance, allowanceTransactionResult } =
    useManageAllowanceTransaction({
      BTREE_CONTRACT_ADDRESS,
      CONTRACT_ADDRESS,
      chainId,
      amount: total - btreeAllowance < 0 ? BigInt(0) : total - btreeAllowance,
    });

  function onClickAllowance() {
    setAllowanceInProgress(true);
    sendAllowance();
  }

  useEffect(() => {
    console.log(
      "refresh UI, transaction successful. allowanceTransactionResult:",
      allowanceTransactionResult,
      "plus",
      {
        btreeAllowance,
        total,
      }
    );
    setAllowanceInProgress(false);
  }, [allowanceTransactionResult, btreeAllowance, total]);

  const displayMintPrice = parseInt(
    ethers.utils.formatEther(mintPrice),
    10
  ).toLocaleString();
  const displayTotalPrice = parseInt(
    ethers.utils.formatEther(total),
    10
  ).toLocaleString();
  const displayBtreeBalance = parseInt(
    ethers.utils.formatEther(btreeBalance),
    10
  ).toLocaleString();
  const displayBtreeAllowance = parseInt(
    ethers.utils.formatEther(btreeAllowance),
    10
  ).toLocaleString();
  const displayAllowanceToCreate = parseInt(
    ethers.utils.formatEther(total - btreeAllowance),
    10
  ).toLocaleString();

  const enoughAllowanceToMint = Boolean(btreeAllowance >= total);
  const notEnoughBtreeToMint = Boolean(btreeBalance < total);

  let mintState = MintState.NotConnected;
  if (address) {
    if (mintComplete) {
      mintState = MintState.MintComplete;
    } else if (allowanceInProgress) {
      mintState = MintState.AllowanceTransactionInProgress;
    } else if (mintInProgress) {
      mintState = MintState.MintTransactionInProgress;
    } else if (enoughAllowanceToMint || allowanceTransactionResult) {
      mintState = MintState.MintStep;
    } else {
      mintState = MintState.AllowanceStep;
    }
  }

  if (mintState === MintState.NotConnected) {
    return (
      <div>
        <p className="text-2xl mt-4">Please connect your wallet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-6 justify-start font-newtimesroman">
        <div className="text-right">Cost per BGOV token:</div>
        <div className="text-left">{displayMintPrice} BTREE</div>
        <div className="text-right">Number of tokens to mint:</div>
        <div className="text-left">
          <input
            className="w-20 input-sm"
            type="number"
            onChange={(e) => calcTotal(e.target.value)}
            step="1"
            min="1"
            value={mintCount}
          />
        </div>
        <div className="text-right">Total price:</div>
        <div className="text-left">
          {displayTotalPrice} <span>BTREE</span>
        </div>
      </div>
      {btreeIsLoading && (
        <div className="mt-2 font-newtimesroman">
          Loading your BTREE holdings and allowance information...
        </div>
      )}
      {!btreeIsLoading && (
        <div className="mt-6 font-newtimesroman w-1/2 mx-auto">
          <p className="text-xl underline">Your BTREE Holdings</p>
          <p className="mt-2">
            Your BTREE holdings are {displayBtreeBalance}.{" "}
            {notEnoughBtreeToMint && (
              <span className="font-bold text-red-500">
                Note that your wallet does not have enough BTREE tokens to mint{" "}
                {mintCount} BGOV token{mintCount > 0 ? "s" : ""}.
              </span>
            )}
          </p>
          <p className="mt-2">
            The allowance of BTREE you've granted for minting is{" "}
            {displayBtreeAllowance}.
          </p>
        </div>
      )}

      <div className="m-4 mt-8 mx-auto max-w-xl font-newtimesroman">
        <p className="text-xl underline">What's required for minting?</p>
        <p className="mt-2">
          To transfer BTREE tokens, you'll need ETH in your wallet. There will
          also be two transactions. The first to grant permissions for our
          contract to transfer BTREE tokens on your behalf, the second to do the
          transfer and mint your equity tokens.
        </p>
      </div>

      {/* only display error if there is enough btree, but something else went wrong */}
      {/* {mintState === MintState.MintStep && error && !notEnoughBtreeToMint && (
        <div className="m-4 mx-auto max-w-xl font-newtimesroman font-bold text-lg text-red-500">
          An error occurred preparing the transaction:{" "}
          {displayFriendlyError(error.message)}
        </div>
      )} */}

      <div className="mt-4 font-newtimesroman">
        {mintState === MintState.AllowanceStep && (
          <button
            className="btn btn-primary"
            onClick={onClickAllowance}
            // disabled={dataForAllowanceTransaction}
          >
            Step 1: Grant permission to transfer {displayAllowanceToCreate}{" "}
            BTREE
          </button>
        )}

        {mintState === MintState.MintStep && (
          <button
            className="btn btn-primary"
            onClick={onClick}
            disabled={
              !Boolean(write) ||
              notEnoughBtreeToMint ||
              mintInProgress ||
              mintComplete
            }
          >
            Step 2: Mint BGOV
          </button>
        )}

        {mintState === MintState.AllowanceTransactionInProgress && (
          <div className="mt-4">
            <div
              className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
              role="status"
            >
              <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
                Loading...
              </span>
            </div>
            <p className="text-2xl mt-2 font-bold">
              Granting BTREE allowance. After you accept transaction, soon this
              button will change to the Mint BGOV step once allowance has
              completed...
            </p>
          </div>
        )}

        {mintState === MintState.MintTransactionInProgress && (
          <div className="mt-4">
            <div
              className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
              role="status"
            >
              <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
                Loading...
              </span>
            </div>
            <p className="text-2xl mt-2 font-bold">
              Minting BGOV. After wallet pops up and you accept transaction,
              please be patient while minting...
            </p>
          </div>
        )}

        {mintState === MintState.MintComplete && (
          <p className="text-2xl mt-2 font-bold">
            Mint should now be complete.
          </p>
        )}
      </div>
    </>
  );
}
