import { useState } from 'react';
import { isLowPerformanceDevice } from '../lib/device';

export function useLowPerfDevice(): boolean {
  const [isLowPerfDevice] = useState(isLowPerformanceDevice);
  return isLowPerfDevice;
}
