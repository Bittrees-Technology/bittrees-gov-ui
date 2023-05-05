import { Link } from "react-router-dom";

function App() {
  return (
    <div className="max-w-4xl mx-auto">
      <header className="bg-[#dedede] border-b-2 border-gray-500">
        <div className="w-full">
          <a href="./" className="mx-auto">
            <img
              className="mx-auto"
              src="/bgov-banner.png"
              width="75%"
              height="75%"
              alt="Bittrees Research banner"
            />
          </a>
        </div>
      </header>

      <main className="text-center bg-[#dedede]">
        <div className="flex flex-col gap-3 p-4 md:p-12 items-center">

          <div className="mt-4">
            <div className="m-4 mx-auto max-w-xl">
              
              
              <div className="grid grid-cols-2 gap-6">
                <div className="text-left font-newtimesroman">
                  <ul className="max-w-md space-y-1 text-gray-400 list-disc list-inside dark:text-gray-400 ">
                    <li className="p-2">
                      <a className="text-black no-underline hover:underline hover:text-green-700" 
                        href="/visionstatement">Vision Statement</a>
                    </li>
                    <li className="p-2">
                      <a className="text-black no-underline hover:underline hover:text-green-700" 
                        href="/codeofethics">Purchase BTREE</a>
                    </li>
                    <li className="p-2">
                      <a className="text-black no-underline hover:underline hover:text-green-700" 
                        href="/codeofethics">BTREE Contract</a>
                    </li>
                    <li className="p-2">
                      <a className="text-black no-underline hover:underline hover:text-green-700" 
                        href="/codeofethics">Mint B-GOV</a>
                    </li>
                    <li className="p-2">
                      <a className="text-black no-underline hover:underline hover:text-green-700" 
                        href="/codeofethics">B-GOV Contract</a>
                    </li>
                  </ul>
                </div>
                <div className="text-left font-newtimesroman">
                  
                  <ul className="max-w-md space-y-1 text-gray-400 list-disc list-inside dark:text-gray-400 ">
                    <li className="p-2">
                      <a className="text-black no-underline hover:underline hover:text-green-700" 
                        target="_blank" 
                        rel="noreferrer"
                        href="https://docs.google.com/document/d/1ncY1zhrYFzpAh9hrSqCmO6z3dftXTfWV1RXHGHrTwlQ/edit">
                        Code of Conduct
                      </a>  
                    </li>
                    <li className="p-2">
                      <a className="text-black no-underline hover:underline hover:text-green-700" 
                        target="_blank" 
                        rel="noreferrer"
                        href="https://docs.google.com/drawings/d/1_AYqj8boh7o8d_CrhSbSUtlvrs0fpTOUEIOxqGd_s58/">
                        Twitter
                      </a>
                    </li>
                    <li className="p-2">
                      <a className="text-black no-underline hover:underline hover:text-green-700" 
                        target="_blank" 
                        rel="noreferrer"
                        href="https://guild.xyz/bittrees-research">
                        Telegram
                      </a>
                    </li>
                    <li className="p-2">
                      <a className="text-black no-underline hover:underline hover:text-green-700" 
                        target="_blank" 
                        rel="noreferrer"
                        href="https://twitter.com/BittreesR">Become a Contributor</a>
                    </li>
                    <li className="p-2">
                      <a className="text-black no-underline hover:underline hover:text-green-700" 
                        target="_blank" 
                        rel="noreferrer"
                        href="https://paragraph.xyz/@bittrees_research">
                        Governance Forum
                      </a>
                    </li>
                    <li className="p-2">
                      <a className="text-black no-underline hover:underline hover:text-green-700" 
                        target="_blank" 
                        rel="noreferrer"
                        href="https://paragraph.xyz/@bittrees_research">
                        Snapshot
                      </a>
                    </li>
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
