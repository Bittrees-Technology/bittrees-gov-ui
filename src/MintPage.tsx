import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Mint } from "./Mint";

function MintPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <header className="bg-[#dedede] border-b-2 border-gray-500">
        <div className="w-full">
          <a href="./" className="mx-auto">
            <img
              className="mx-auto"
              src="/br-banner.jpg"
              width="75%"
              height="75%"
              alt="Bittrees Research banner"
            />
          </a>
        </div>
      </header>

      <main className="text-center bg-[#dedede]">
        <div className="flex flex-col gap-3 p-4 md:p-12 items-center">
          <div className="mx-auto flex flex-col items-center max-w-md">
            <img
              src="/bittrees-membership-card.png"
              width="1400px"
              height="800px"
              alt="Bittrees Research Membership Card"
            />
          </div>
          <div className="mt-4">
            <Mint />
          </div>
          <div>
            <ConnectButton />
          </div>
          <div className="space-y-5 mt-8 font-newtimesroman">
            <div className="md:px-8">
              <hr className="border-gray-500" />
            </div>
            <p className="md:px-12 text-justify">
              Bittrees Research is an organization focused on promoting research
              in emerging technologies, systems innovation, and related fields
              with a goal of creating new knowledge and tools whilst fostering
              innovation with a positive impact in the metaverse and beyond.
            </p>
            <p className="md:px-12 text-justify">
              By studying a wide range of topics, Bittrees Research generates
              insights that can inform policy, strategy, and decision-making
              processes, helping to advance society towards a better future.
            </p>
            <p className="md:px-12 text-justify">
              Bittrees Research places a strong emphasis on historical and
              contextual relevance, recognizing the importance of understanding
              past successes and failures in order to develop effective
              solutions for a more just and equitable society. Join the
              conversation on how emerging technologies and systems innovation
              can help create a more equitable and sustainable world.
            </p>
            <p className="md:px-12 text-justify">
              Memberships are subject to an expiration 360 days from the date of
              mint.
            </p>
          </div>
          <footer className="flex flex-col gap-6 mx-auto mt-4">
            <span>
              <a className="hover:text-green-700" href="https://twitter.com/BittreesR" target="_blank" rel="noreferrer">
                <span className="inline-block align-middle pr-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 hover:text-green-700"
                  fill="currentColor"
                  viewBox="0 0 24 24">
                  <path
                    d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
                </svg>
                </span>
                <span className="inline-block align-middle underline font-newtimesroman pr-1">BittreesR</span>
              </a>
            </span>
            <div>
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

export default MintPage;
