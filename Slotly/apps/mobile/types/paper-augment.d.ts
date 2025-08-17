// Make React Native Paper's MD3Colors aware of our custom semantic colors
import "react-native-paper";

declare global {
  namespace ReactNativePaper {
    interface MD3Colors {
      // semantic colors we add on top of MD3
      success: string;
      onSuccess: string;
      warning: string;
      onWarning: string;
      info: string;
      onInfo: string;
    }
  }
}

// ensure this file is treated as a module
export {};
