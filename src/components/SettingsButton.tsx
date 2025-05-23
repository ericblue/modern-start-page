import { useState, useEffect } from 'react';
import type { UserConfig } from '../config/types';
import SettingsModal from './SettingsModal';
import { Icon } from './Icon';

interface SettingsButtonProps {
  config: UserConfig;
  onConfigChange: (newConfig: UserConfig) => Promise<void>;
}

export default function SettingsButton({ config, onConfigChange }: SettingsButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // Update search visibility when modal state changes
    const searchElement = document.querySelector('.search-container');
    if (searchElement) {
      searchElement.classList.toggle('hidden', isModalOpen);
    }
  }, [isModalOpen]);

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex items-center space-x-2 px-3 py-1 rounded bg-secondary-700/50 text-secondary-300 hover:bg-secondary-700"
      >
        <Icon name="Settings2" size={20} />
        <span>Settings</span>
      </button>

      {isModalOpen && (
        <SettingsModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          config={config}
          onConfigChange={onConfigChange}
        />
      )}
    </>
  );
} 