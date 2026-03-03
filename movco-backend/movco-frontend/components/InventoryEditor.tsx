// components/InventoryEditor.tsx
'use client';

import { useState } from 'react';

type Item = { name: string; note: string; quantity: number };

type Props = {
  items: Item[];
  onSave: (items: Item[]) => void;
  readOnly?: boolean;
};

const COMMON_ITEMS = [
  { name: 'Sofa - 2 Seater', note: '~35 ft³' },
  { name: 'Sofa - 3 Seater', note: '~45 ft³' },
  { name: 'Sofa - Corner/L-Shape', note: '~60 ft³' },
  { name: 'Armchair', note: '~20 ft³' },
  { name: 'Coffee Table', note: '~10 ft³' },
  { name: 'TV Unit / Stand', note: '~15 ft³' },
  { name: 'TV 50-65 inch', note: '~8 ft³' },
  { name: 'Bookcase', note: '~25 ft³' },
  { name: 'Sideboard', note: '~25 ft³' },
  { name: 'Display Cabinet', note: '~30 ft³' },
  { name: 'Standard Lamp', note: '~5 ft³' },
  { name: 'Mirror - Large', note: '~6 ft³' },
  { name: 'Rug - Large', note: '~8 ft³' },
  { name: 'Single Bed + Mattress', note: '~40 ft³' },
  { name: 'Double Bed + Mattress', note: '~55 ft³' },
  { name: 'King Bed + Mattress', note: '~65 ft³' },
  { name: 'Super King Bed + Mattress', note: '~75 ft³' },
  { name: 'Bunk Bed', note: '~55 ft³' },
  { name: 'Cot / Toddler Bed', note: '~20 ft³' },
  { name: 'Wardrobe - Single', note: '~35 ft³' },
  { name: 'Wardrobe - Double', note: '~65 ft³' },
  { name: 'Chest of Drawers', note: '~20 ft³' },
  { name: 'Bedside Table', note: '~5 ft³' },
  { name: 'Dressing Table', note: '~15 ft³' },
  { name: 'Fridge Freezer', note: '~30 ft³' },
  { name: 'American Fridge Freezer', note: '~40 ft³' },
  { name: 'Washing Machine', note: '~30 ft³' },
  { name: 'Tumble Dryer', note: '~25 ft³' },
  { name: 'Dishwasher', note: '~25 ft³' },
  { name: 'Microwave', note: '~5 ft³' },
  { name: 'Kitchen Table', note: '~15 ft³' },
  { name: 'Kitchen Chair', note: '~5 ft³' },
  { name: 'Dining Table - 4 Seat', note: '~20 ft³' },
  { name: 'Dining Table - 6 Seat', note: '~30 ft³' },
  { name: 'Dining Chair', note: '~5 ft³' },
  { name: 'China Cabinet', note: '~35 ft³' },
  { name: 'Office Desk', note: '~20 ft³' },
  { name: 'Office Chair', note: '~10 ft³' },
  { name: 'Filing Cabinet', note: '~15 ft³' },
  { name: 'Desktop PC + Monitor', note: '~8 ft³' },
  { name: 'Patio Table + 4 Chairs', note: '~25 ft³' },
  { name: 'BBQ', note: '~15 ft³' },
  { name: 'Lawnmower', note: '~10 ft³' },
  { name: 'Garden Tools Bundle', note: '~8 ft³' },
  { name: 'Small Box (Book Box)', note: '~2 ft³' },
  { name: 'Medium Box', note: '~3 ft³' },
  { name: 'Large Box', note: '~5 ft³' },
  { name: 'Wardrobe Box', note: '~10 ft³' },
  { name: 'Bicycle', note: '~10 ft³' },
  { name: 'Piano - Upright', note: '~50 ft³' },
  { name: 'Piano - Grand', note: '~80 ft³' },
  { name: 'Exercise Bike / Treadmill', note: '~20 ft³' },
  { name: 'Pushchair / Pram', note: '~8 ft³' },
  { name: 'Suitcase - Large', note: '~5 ft³' },
];

function parseVolume(note: string): number {
  const match = note.match(/~?(\d+(?:\.\d+)?)\s*ft/);
  return match ? parseFloat(match[1]) : 0;
}

function totalVolume(items: Item[]): number {
  return items.reduce((sum, item) => sum + parseVolume(item.note) * item.quantity, 0);
}

export default function InventoryEditor({ items: initialItems, onSave, readOnly = false }: Props) {
  const [items, setItems] = useState<Item[]>(initialItems || []);
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');
  const [customName, setCustomName] = useState('');
  const [customVolume, setCustomVolume] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const updateItems = (updated: Item[]) => {
    setItems(updated);
    setHasChanges(true);
  };

  const removeItem = (idx: number) => {
    updateItems(items.filter((_, i) => i !== idx));
  };

  const updateQuantity = (idx: number, delta: number) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], quantity: Math.max(1, updated[idx].quantity + delta) };
    updateItems(updated);
  };

  const addCommonItem = (common: { name: string; note: string }) => {
    const existing = items.findIndex(i => i.name.toLowerCase() === common.name.toLowerCase());
    if (existing >= 0) {
      updateQuantity(existing, 1);
    } else {
      updateItems([...items, { name: common.name, note: common.note, quantity: 1 }]);
    }
    setShowAddModal(false);
    setSearch('');
  };

  const addCustomItem = () => {
    if (!customName.trim()) return;
    const vol = parseFloat(customVolume) || 10;
    updateItems([...items, { name: customName.trim(), note: `~${vol} ft³`, quantity: 1 }]);
    setCustomName('');
    setCustomVolume('');
    setShowAddModal(false);
  };

  const handleSave = () => {
    onSave(items);
    setHasChanges(false);
  };

  const filteredCommon = COMMON_ITEMS.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  const vol = totalVolume(items);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="bg-white rounded-xl border">
      {/* Header */}
      <div className="px-5 py-4 border-b flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900">Inventory List</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {itemCount} item{itemCount !== 1 ? 's' : ''} &middot; ~{vol.toFixed(0)} ft³ total
            &middot; ~{(vol * 0.0283168).toFixed(1)} m³
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && (
            <button onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition">
              + Add Item
            </button>
          )}
          {hasChanges && !readOnly && (
            <button onClick={handleSave}
              className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition">
              Save Changes
            </button>
          )}
        </div>
      </div>

      {/* Items list */}
      <div className="divide-y max-h-96 overflow-y-auto">
        {items.length === 0 ? (
          <div className="px-5 py-12 text-center text-gray-400 text-sm">
            No items in inventory. Click &quot;Add Item&quot; to get started.
          </div>
        ) : (
          items.map((item, idx) => (
            <div key={idx} className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 group">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                <p className="text-xs text-gray-400">{item.note}</p>
              </div>

              {!readOnly ? (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => updateQuantity(idx, -1)}
                    className="w-7 h-7 rounded-md border text-gray-500 hover:bg-gray-100 flex items-center justify-center text-sm font-bold">
                    -
                  </button>
                  <span className="w-8 text-center text-sm font-semibold text-gray-900">{item.quantity}</span>
                  <button onClick={() => updateQuantity(idx, 1)}
                    className="w-7 h-7 rounded-md border text-gray-500 hover:bg-gray-100 flex items-center justify-center text-sm font-bold">
                    +
                  </button>
                </div>
              ) : (
                <span className="text-sm font-semibold text-gray-600 flex-shrink-0">x{item.quantity}</span>
              )}

              <span className="text-xs text-gray-400 w-16 text-right flex-shrink-0">
                {(parseVolume(item.note) * item.quantity).toFixed(0)} ft³
              </span>

              {!readOnly && (
                <button onClick={() => removeItem(idx)}
                  className="w-7 h-7 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition opacity-0 group-hover:opacity-100">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Volume summary bar */}
      {items.length > 0 && (
        <div className="px-5 py-3 border-t bg-gray-50 flex items-center justify-between text-sm">
          <span className="text-gray-500">Total volume</span>
          <span className="font-bold text-gray-900">~{vol.toFixed(0)} ft³ ({(vol * 0.0283168).toFixed(1)} m³)</span>
        </div>
      )}

      {/* Add item modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => { setShowAddModal(false); setSearch(''); }}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b">
              <h3 className="font-bold text-gray-900 text-lg">Add Item</h3>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search common items..."
                autoFocus className="w-full mt-3 px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>

            <div className="overflow-y-auto flex-1 divide-y">
              {filteredCommon.map((item, idx) => (
                <button key={idx} onClick={() => addCommonItem(item)}
                  className="w-full px-5 py-3 text-left hover:bg-blue-50 flex items-center justify-between transition">
                  <span className="text-sm font-medium text-gray-900">{item.name}</span>
                  <span className="text-xs text-gray-400">{item.note}</span>
                </button>
              ))}
              {filteredCommon.length === 0 && (
                <div className="px-5 py-6 text-center text-gray-400 text-sm">
                  No matching items found. Add a custom item below.
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t bg-gray-50 rounded-b-2xl">
              <p className="text-xs font-semibold text-gray-500 mb-2">Or add a custom item:</p>
              <div className="flex gap-2">
                <input value={customName} onChange={e => setCustomName(e.target.value)}
                  placeholder="Item name" className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                <input value={customVolume} onChange={e => setCustomVolume(e.target.value)}
                  placeholder="ft³" type="number" className="w-16 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                <button onClick={addCustomItem}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition">
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
