import { useEffect, useRef, useState } from 'react';
import { Btn, Out } from '../_shared/ui';

export default function PiPDemo() {
  const ref = useRef<HTMLVideoElement>(null);
  const [out, setOut] = useState('—');
  const [active, setActive] = useState(false);

  // Keep button state in sync if the user closes the PiP window from its own controls.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const enter = () => setActive(true);
    const leave = () => setActive(false);
    v.addEventListener('enterpictureinpicture', enter);
    v.addEventListener('leavepictureinpicture', leave);
    return () => {
      v.removeEventListener('enterpictureinpicture', enter);
      v.removeEventListener('leavepictureinpicture', leave);
    };
  }, []);

  async function toggle() {
    const v = ref.current;
    if (!v) return;
    if (!('pictureInPictureEnabled' in document) || !document.pictureInPictureEnabled)
      return setOut('unsupported or disabled');
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setOut('closed');
        return;
      }
      // PiP requires the video to actually be playing with decoded frames.
      if (v.paused) await v.play();
      await v.requestPictureInPicture();
      setOut('opened');
    } catch (e) {
      setOut((e as Error).message);
    }
  }

  return (
    <div>
      <video
        ref={ref}
        autoPlay
        loop
        muted
        playsInline
        className="w-full max-w-xs rounded bg-black/40"
      >
        <source src="/demo-video.mp4" type="video/mp4" />
        <source src="/demo-video.webm" type="video/webm" />
      </video>
      <div className="mt-2">
        <Btn onClick={toggle}>{active ? 'Close PiP' : 'Open PiP'}</Btn>
      </div>
      <Out>{out}</Out>
    </div>
  );
}
