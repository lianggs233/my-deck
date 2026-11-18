import { useEffect, useRef, useState } from 'react'

/**
 * 重新發送倒數計時（秒）。
 * restartKey 改變時，下一個 tick 會以 initialSeconds 重新倒數。
 */
export function useCountdown(initialSeconds: number, restartKey: unknown = 0) {
  const [countdown, setCountdown] = useState(() => ({
    key: restartKey,
    secondsLeft: initialSeconds,
  }))
  const restartRef = useRef({ key: restartKey, seconds: initialSeconds })

  useEffect(() => {
    restartRef.current = { key: restartKey, seconds: initialSeconds }
  }, [restartKey, initialSeconds])

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((previous) => {
        const restart = restartRef.current
        if (restart.key !== previous.key) {
          return { key: restart.key, secondsLeft: restart.seconds }
        }
        return { ...previous, secondsLeft: Math.max(0, previous.secondsLeft - 1) }
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return countdown.secondsLeft
}
