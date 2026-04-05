import React from 'react';
import { topBarLeft, topBarRight } from './constants';

interface TopBarProps {
  isTopBarLeftHomeBtnClick: boolean;
  veIsCodeFreeze: boolean;
  onTopBarLeftBtnClick: (tooltip: string) => void;
  onTopBarHomeBtnClick: (name: string) => void;
  onCodeFreezeToggle: () => void;
}

const topSubBarHome = [
  { name: 'open', tooltip: 'open' },
  { name: 'save', tooltip: 'save' },
  { name: 'export', tooltip: 'export' },
  { name: 'shortcuts', tooltip: 'shortcuts' },
  { name: 'guide', tooltip: 'guide' },
];

export const TopBar: React.FC<TopBarProps> = ({
  isTopBarLeftHomeBtnClick,
  veIsCodeFreeze,
  onTopBarLeftBtnClick,
  onTopBarHomeBtnClick,
  onCodeFreezeToggle,
}) => {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] w-fit h-fit bg-[var(--wb-panel-bg)] text-[var(--wb-panel-text)] rounded-xl flex justify-center items-center gap-2 shadow-md border border-[var(--wb-panel-border)] py-2">
      <div className="flex gap-3 px-2">
        {topBarLeft.map((item, idx) => (
          <button
            key={idx}
            className="rounded-lg p-1 text-xl hover:bg-[var(--wb-panel-hover)] outline-none"
            title={item.tooltip}
            onClick={() => onTopBarLeftBtnClick(item.tooltip)}
          >
            <i className={item.name} />
          </button>
        ))}
        <div
          className="flex justify-center items-center px-3 text-base bg-[var(--wb-panel-active)] rounded-lg cursor-pointer gap-2 hover:bg-[var(--wb-panel-hover)]"
          title="freeze code"
          onClick={onCodeFreezeToggle}
        >
          <div className={veIsCodeFreeze ? 'ri-lock-line' : 'ri-lock-unlock-line'} />
          <div>freeze</div>
        </div>
        {topBarRight.map((item, idx) => (
          <button
            key={idx}
            className="rounded-lg p-1 text-xl hover:bg-[var(--wb-panel-hover)]"
            title={item.tooltip}
          >
            <i className={item.name} />
          </button>
        ))}
        <div
          className={`absolute top-14 left-0 w-24 h-36 bg-[var(--wb-panel-secondary)] border border-[var(--wb-panel-border)] shadow-md rounded-xl ${isTopBarLeftHomeBtnClick ? '' : 'hidden'}`}
        >
          <div className="flex flex-col gap-1">
            {topSubBarHome.map((item, idx) => (
              <div
                key={idx}
                className="text-base font-semibold cursor-pointer px-2 rounded-md hover:bg-[var(--wb-panel-hover)] transition-all ease-in"
                onClick={() => onTopBarHomeBtnClick(item.name)}
              >
                {item.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
