import { useState, useEffect, useRef } from 'react'
import {
  ConnectButton,
  useCurrentAccount,
  useDisconnectWallet,
} from '@mysten/dapp-kit'

export function ConnectWallet() {
  const currentAccount = useCurrentAccount()
  const { mutate: disconnect } = useDisconnectWallet()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  if (!currentAccount) {
    return <ConnectButton className="btn primary" />
  }

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const handleDisconnect = () => {
    disconnect()
    setIsOpen(false)
  }

  return (
    <div className="wallet-dropdown" ref={dropdownRef}>
      <button
        className="wallet-button"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="wallet-address">{formatAddress(currentAccount.address)}</span>
        <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="wallet-dropdown-menu">
          <button
            className="wallet-dropdown-item disconnect-button"
            onClick={handleDisconnect}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  )
}
