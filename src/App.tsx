function App() {
  return (
    <div className="max-w-4xl mx-auto">
      <header className="border-2 bg-base-100">
        <div className="w-full">
          <div className="font-newtimesroman p-32 h-80 pb-0 text-7xl text-center font-bold tracking-wider">
            Bittrees, Inc
          </div>
        </div>
      </header>

      <main className="text-center bg-base-100 border-2 border-t-0">
        <div className="flex flex-col gap-3 p-4 md:p-12 items-center">
          <div className="mt-4">
            <div className="m-4 mx-auto max-w-xl">
              <div className="grid grid-cols-2 gap-6">
                <div className="text-left font-newtimesroman">
                  <ul className="max-w-md space-y-1 text-gray-400 list-disc list-inside dark:text-gray-400 ">
                    <li className="p-2">
                      <a
                        className="text-black no-underline hover:underline hover:text-green-700"
                        href="/visionstatement"
                      >
                        Vision Statement
                      </a>
                    </li>
                    <li className="p-2">
                      <a
                        className="text-black no-underline hover:underline hover:text-green-700"
                        target="_blank"
                        rel="noreferrer"
                        href="https://app.uniswap.org/#/swap?inputCurrency=0x6bdde71cf0c751eb6d5edb8418e43d3d9427e436&outputCurrency=ETH&use=V2"
                      >
                        Purchase BTREE
                      </a>
                    </li>
                    <li className="p-2">
                      <a
                        className="text-black no-underline hover:underline hover:text-green-700"
                        target="_blank"
                        rel="noreferrer"
                        href="https://etherscan.io/token/0x6bDdE71Cf0C751EB6d5EdB8418e43D3d9427e436#code"
                      >
                        BTREE Contract
                      </a>
                    </li>
                    <li className="p-2">
                      <a
                        className="text-black no-underline hover:underline hover:text-green-700"
                        href="/mint"
                      >
                        Mint BGOV
                      </a>
                    </li>
                    <li className="p-2">BGOV Contract</li>
                  </ul>
                </div>
                <div className="text-left font-newtimesroman">
                  <ul className="max-w-md space-y-1 text-gray-400 list-disc list-inside dark:text-gray-400 ">
                    <li className="p-2">
                      <a
                        className="text-black no-underline hover:underline hover:text-green-700"
                        href="/codeofconduct"
                      >
                        Code of Conduct
                      </a>
                    </li>
                    <li className="p-2">
                      <a
                        className="text-black no-underline hover:underline hover:text-green-700"
                        target="_blank"
                        rel="noreferrer"
                        href="https://twitter.com/bittrees_"
                      >
                        Twitter
                      </a>
                    </li>
                    <li className="p-2">
                      <a
                        className="text-black no-underline hover:underline hover:text-green-700"
                        target="_blank"
                        rel="noreferrer"
                        href="https://t.me/BittreesCommunity"
                      >
                        Telegram
                      </a>
                    </li>
                    <li className="p-2">
                      <a
                        className="text-black no-underline hover:underline hover:text-green-700"
                        target="_blank"
                        rel="noreferrer"
                        href="https://docs.google.com/forms/d/e/1FAIpQLSda4_d_dRSMCPG-LuXaloZ5e4Zs07-6SyzVOQF0MYpOfZGF8g/viewform"
                      >
                        Become a Contributor
                      </a>
                    </li>
                    <li className="p-2">Governance Forum</li>
                    <li className="p-2">Snapshot</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <footer className="flex flex-col gap-6 mx-auto mt-4">
            <div className="flex w-full justify-center items-center">
              <a href="/" className="mx-auto">
                <img
                  src="/bittrees_logo_tree.png"
                  width="128px"
                  height="128px"
                  alt="Bittrees Research logo"
                  className="grayscale max-w-xs transition duration-300 ease-in-out hover:scale-110"
                />
              </a>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;
