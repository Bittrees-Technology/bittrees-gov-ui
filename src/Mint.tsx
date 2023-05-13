import {
  useAccount,
  usePrepareContractWrite,
  useContractWrite,
  useWaitForTransaction,
  Address,
} from "wagmi";
import abi from "./abi.json";
import btreeAbi from "./abi-btree.json";
import {
  goerli,
  // mainnet
} from "wagmi/chains";
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { useBtreeInformation } from "./useBtreeInformation";

const CONTRACT_ADDRESS = "0x81Ed0A98c0BD6A75240fD4F65E5e2c43d7b343D9";
const BTREE_CONTRACT_ADDRESS = "0x1Ca23BB7dca2BEa5F57552AE99C3A44fA7307B5f";

// const chainId =
//   process.env.REACT_APP_ENABLE_TESTNETS === "true" ? goerli.id : mainnet.id;
const chainId = goerli.id;

console.info(`Contract: ${CONTRACT_ADDRESS}`);
console.info(`Chain ID: ${chainId}`);

const mintPrice = ethers.utils.parseUnits("1000.0", "ether").toBigInt();

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
  // const [allowance, setAllowance] = useState<bigint>(BigInt(0));
  // const [btreeBalance, setBtreeBalance] = useState<bigint>(BigInt(0));
  const [total, setTotal] = useState<bigint>(mintPrice);

  const { address } = useAccount();
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

  const { config, error } = usePrepareContractWrite({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: "mint",
    chainId,
    args: [0x0, address, mintCount], // 0x0 is BTREE
  });
  const { isLoading, write } = useContractWrite(config);

  function onClick() {
    write?.();
  }

  const { config: configAllowance } = usePrepareContractWrite({
    address: BTREE_CONTRACT_ADDRESS,
    abi: btreeAbi,
    functionName: "increaseAllowance",
    chainId,
    args: [CONTRACT_ADDRESS, (total - btreeAllowance).toString()],
  });

  const [allowanceHash, setAllowanceHash] = useState<Address | undefined>();

  const {
    data: allowanceData,
    isLoading: isLoadingAllowance,
    write: writeAllowance,
  } = useContractWrite(configAllowance);

  function onClickAllowance() {
    writeAllowance?.();
  }

  useEffect(() => {
    console.log(
      "allowanceData",
      allowanceData,
      "blockHash",
      allowanceData?.hash
    );
    setAllowanceHash(allowanceData?.hash);
  }, [allowanceData]);

  const {
    isLoading: isWaitingForAllowanceTransaction,
    data: dataForAllowanceTransaction,
  } = useWaitForTransaction({
    hash: allowanceHash,
    chainId,
    enabled: Boolean(allowanceHash),
    confirmations: 5,
  });

  console.log({
    isWaitingForAllowanceTransaction,
    dataForAllowanceTransaction,
    allowanceHash,
  });

  useEffect(() => {
    console.log("refresh UI, transaction successful");
  }, [dataForAllowanceTransaction]);

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

  if (!address) {
    return (
      <div className="m-4 text-xl">
        Please connect your wallet to mint BGOV tokens.
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
                {mintCount} BGOV tokens.
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

      <div className="text-2xl text-red-500">
        This site is on GOERLI testnet and is not live yet.
        <br />
        Real BGOV tokens are not mintable yet.
      </div>

      {enoughAllowanceToMint && error && (
        <div className="m-4 mx-auto max-w-xl font-newtimesroman font-bold text-lg text-red-500">
          An error occurred preparing the transaction:{" "}
          {displayFriendlyError(error.message)}
        </div>
      )}

      {/* TODO:
  - [ ] create a display variable that determines when to display/disable Allowance button
  - [ ] refresh users allowance in UI (which should increase after allowance transaction is successful)
  - [ ] split hook logic into multiple hooks for maintainability
  - [ ] add similar logic for detecting successful mint transaction and updating UI
  */}
      <div className="mt-4 font-newtimesroman">
        {!enoughAllowanceToMint && !dataForAllowanceTransaction && (
          <button
            className="btn btn-primary"
            onClick={onClickAllowance}
            // disabled={dataForAllowanceTransaction}
          >
            Step 1: Grant permission to transfer {displayAllowanceToCreate}{" "}
            BTREE
          </button>
        )}
        {enoughAllowanceToMint && (
          <button
            className="btn btn-primary"
            onClick={onClick}
            disabled={!Boolean(write) || notEnoughBtreeToMint}
          >
            Step 2: Mint BGOV
          </button>
        )}

        {!address && (
          <p className="text-2xl mt-4">Please connect your wallet.</p>
        )}
        {isLoadingAllowance && (
          <p className="text-2xl mt-4 font-bold">Granting BTREE allowance...</p>
        )}
        {isLoading && <p className="text-2xl mt-4 font-bold">Minting...</p>}
      </div>
    </>
  );
}
