const STYLE_ID = 'mc-menu-style';

export function ensureMenuStyles(): void {
  if (document.getElementById(STYLE_ID) !== null) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.mc-menu {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(20, 20, 30, 0.85);
  pointer-events: auto;
  z-index: 100;
  font-family: monospace;
  color: #fff;
  user-select: none;
  padding: 24px;
  box-sizing: border-box;
}
.mc-menu-title {
  font-size: 44px;
  font-weight: bold;
  color: #fff;
  text-shadow: 2px 2px 0 #000, 4px 4px 6px rgba(0, 0, 0, 0.6);
  margin-bottom: 8px;
  letter-spacing: 2px;
}
.mc-menu-subtitle {
  font-size: 18px;
  color: #bdbdc7;
  margin-bottom: 28px;
  text-shadow: 1px 1px 2px #000;
}
.mc-menu-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  max-width: 400px;
  align-items: stretch;
}
.mc-btn {
  display: inline-block;
  background: linear-gradient(#8b8b8b, #6b6b6b);
  border: 2px solid #000;
  color: #fff;
  text-shadow: 1px 1px 0 #000;
  padding: 12px 16px;
  font-family: monospace;
  font-size: 16px;
  cursor: pointer;
  min-width: 300px;
  box-sizing: border-box;
  transition: background 80ms ease-in-out, transform 80ms ease-in-out;
  outline: none;
}
.mc-btn:hover:not(:disabled) {
  background: linear-gradient(#a8a8a8, #858585);
}
.mc-btn:active:not(:disabled) {
  transform: translateY(1px);
}
.mc-btn:focus-visible {
  border-color: #fff;
}
.mc-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.mc-btn-danger {
  background: linear-gradient(#a04040, #803030);
}
.mc-btn-danger:hover:not(:disabled) {
  background: linear-gradient(#c25252, #9a3838);
}
.mc-btn-small {
  min-width: 0;
  padding: 6px 10px;
  font-size: 13px;
}
.mc-input {
  background: #1d1d24;
  color: #fff;
  border: 1px solid #555;
  padding: 8px 10px;
  font-family: monospace;
  font-size: 14px;
  box-sizing: border-box;
  width: 100%;
  outline: none;
}
.mc-input:focus {
  border-color: #999;
}
.mc-select {
  background: #1d1d24;
  color: #fff;
  border: 1px solid #555;
  padding: 8px 10px;
  font-family: monospace;
  font-size: 14px;
  box-sizing: border-box;
  width: 100%;
  outline: none;
}
.mc-select:focus {
  border-color: #999;
}
.mc-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  background: #1d1d24;
  border: 1px solid #555;
  outline: none;
  cursor: pointer;
}
.mc-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 18px;
  background: linear-gradient(#bdbdbd, #8a8a8a);
  border: 1px solid #000;
  cursor: pointer;
}
.mc-slider::-moz-range-thumb {
  width: 14px;
  height: 18px;
  background: linear-gradient(#bdbdbd, #8a8a8a);
  border: 1px solid #000;
  cursor: pointer;
}
.mc-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.mc-form-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}
.mc-form-row label {
  font-size: 12px;
  color: #aaa;
}
.mc-form-helper {
  font-size: 11px;
  color: #888;
  margin-top: 2px;
}
.mc-error {
  color: #ff6b6b;
  font-size: 12px;
  margin-top: 2px;
  min-height: 14px;
}
.mc-checkbox-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  cursor: pointer;
}
.mc-checkbox-row label {
  font-size: 13px;
  color: #ddd;
  cursor: pointer;
}
.mc-checkbox-row input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}
.mc-worlds-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 480px;
  max-height: 50vh;
  overflow-y: auto;
  margin-bottom: 12px;
  padding: 4px;
  box-sizing: border-box;
}
.mc-world-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: rgba(40, 40, 50, 0.8);
  border: 2px solid #333;
  padding: 10px 12px;
  cursor: pointer;
  transition: border-color 80ms ease-in-out, background 80ms ease-in-out;
}
.mc-world-item:hover {
  background: rgba(55, 55, 70, 0.9);
}
.mc-world-item.selected {
  border-color: #ffd24a;
}
.mc-world-name {
  font-size: 16px;
  color: #fff;
  font-weight: bold;
}
.mc-world-meta {
  font-size: 11px;
  color: #aaa;
}
.mc-world-actions {
  display: flex;
  flex-direction: row;
  gap: 6px;
  margin-top: 6px;
}
.mc-world-empty {
  color: #aaa;
  font-size: 14px;
  text-align: center;
  padding: 24px;
  border: 1px dashed #555;
  margin-bottom: 12px;
}
.mc-confirm-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  background: rgba(80, 30, 30, 0.9);
  border: 2px solid #803030;
  padding: 10px 12px;
}
.mc-confirm-text {
  font-size: 13px;
  color: #fff;
}
.mc-settings-list {
  width: 100%;
  max-width: 460px;
  max-height: 65vh;
  overflow-y: auto;
  padding: 4px 12px 4px 4px;
  box-sizing: border-box;
}
.mc-setting-value {
  font-size: 12px;
  color: #ffd24a;
}
.mc-form-row .mc-setting-label-row {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: baseline;
}
`;
  document.head.appendChild(style);
}
