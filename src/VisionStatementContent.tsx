import { useAccount } from "wagmi";
import { useState, useEffect } from "react";
import { useCookies } from 'react-cookie';
import { hasActiveMembership, CONTRACT_ADDRESS } from './alchemy';

/**
 * VisionStatementContent React component.
 *
 */
export function VisionStatementContent() {
  const [loading, setLoading] = useState(true);
  const [hasValidMembership, setHasValidMembership] = useState(false);
  const [cookies, setCookie] = useCookies([CONTRACT_ADDRESS]);

  const { address, isConnected, isConnecting } = useAccount({
    onConnect({ address, connector, isReconnected }) {
      console.log("Connected", { address, connector, isReconnected });
    },
  });

  useEffect(() => {
    let token = cookies[CONTRACT_ADDRESS];
    if (!token) {

      console.log("isConnected: " + isConnected);
      if (!(address && isConnected)) {
        setHasValidMembership(false);
        return;
      }
  
      hasActiveMembership(address)
        .then((hasActiveMembership) => {
          if (hasActiveMembership) {
            setCookie(CONTRACT_ADDRESS, address, {
              path: '/',
            });
          } 
          setHasValidMembership(hasActiveMembership);
        })
        .catch((err) => {
          console.error(err);
          setHasValidMembership(false);
        })
        .finally(() => {
          setLoading(false);
        });

    } else {
      setHasValidMembership(true);
      setLoading(false);
    }
  }, [address, isConnected, cookies, setCookie]);

  return (
    <>
      <div className="mt-4 font-newtimesroman">
        {!address && (
          <p className="text-2xl mt-4">Please connect your wallet.</p>
        )}
        {loading && isConnecting && <p className="text-2xl mt-4">Loading...</p>}
      </div>

      {hasValidMembership && (
        <div className="m-4 mx-auto max-w-xl">
          <h2 className="text-xl font-bold font-newtimesroman text-left">Vision Statement</h2>
          <br />
          <div className="text-l font-newtimesroman text-left">
            Dear reader,
            <br/><br/>
            At Bittrees Research, we are a purpose-driven organization that exists to advance society towards a more just and equitable future by funding public goods and promoting research in emerging technologies and systems innovation. We recognize the importance of historical and contextual relevance in our work, and strive to create new knowledge, tools, and systems that have a positive impact in the metaverse and beyond.
            <br/><br/>
            Our organization is made up of a diverse group of individuals who are passionate about using their expertise and resources to create a better world. We bring together researchers, innovators, creatives, and community members to collaborate on cutting-edge projects that contribute to our shared vision of a more equitable and sustainable society.
            <br/><br/>
            Our goals are to generate insights that can inform policy, strategy, and decision-making processes, to fund public goods that benefit humankind, and to foster innovation with a human-centric focus. We are committed to staying true to our values of transparency, accountability, and community-driven decision making in all aspects of our work.
            <br/><br/>
            If you share our vision and want to be a part of this important work, we invite you to join us. Together, we can make a meaningful difference in the world.
            <br/><br/>
            Thanks,<br/>
            Jonathan
          </div>
        </div>
      )}

      {!hasValidMembership && (
        <div className="m-4 mx-auto max-w-xl font-newtimesroman">
          <a href="/mint">Please go mint your membership!</a>
        </div>
      )}
    </>
  );
}
