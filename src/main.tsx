import React, { useEffect, useState } from "react";
import {
  dispatchTS,
  getColorTheme,
  listenTS,
  subscribeColorTheme,
} from "./utils/utils";


export const App = () => {
  
  const [lightOrDarkMode, setLightOrDarkMode] = useState(getColorTheme());
  useEffect(() => {
    subscribeColorTheme((mode) => {
      setLightOrDarkMode(mode);
    });
  }, []);
  return (
    <>
      <main className="plugin-container">
        <button 
          onClick={() => {
            console.log('Button clicked!');
          }}
          className="primary-button"
        >
          Click me
        </button>
      </main>
    </>
  );
};
