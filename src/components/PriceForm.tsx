import { useState } from 'preact/hooks';
import { decimalComma, fmt, parseNum, t } from '../lib/i18n';
import type { Serving } from '../lib/nutrients';
import { gramsPerDl, MAX_PRICE, type PriceUnit } from '../lib/shopping';
import { tsh } from '../lib/strings-shop';

/** Units a food's shelf price can be typed in: kg always, l with a dl/glas measure, st with a piece. */
function priceUnits(units: Serving[]): PriceUnit[] {
  return ['kg', ...(gramsPerDl(units) ? (['l'] as const) : []), ...(units.some((x) => x.name === 'st') ? (['st'] as const) : [])];
}

export const numText = (n: number) => String(Math.round(n * 100) / 100).replace('.', decimalComma() ? ',' : '.');

interface Props {
  /** A food's measures (its comparison price: kr/kg, kr/l, kr/st), or null for a plain price in kr. */
  units: Serving[] | null;
  /** What is stored, as typed text (kr/kg for a food), shown so it can be checked. */
  initial: string;
  stored: boolean;
  /** The food's typical price (kr/kg, M33) when it has no own price: a hint. */
  typical?: number;
  onSave: (kr: number, unit: PriceUnit) => void;
  onClear: () => void;
}

/** The price editor of the shopping list (M30) and the diary's price sheet (M34). */
export function PriceForm(props: Props) {
  const [kr, setKr] = useState(props.initial);
  const [unit, setUnit] = useState<PriceUnit>('kg');
  const n = parseNum(kr);
  const valid = n > 0 && n < MAX_PRICE;
  const food = props.units != null;
  return (
    <form
      class="row shop-price"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) props.onSave(n, unit);
      }}
    >
      <label>
        {food ? tsh('shopPriceLabel') : tsh('shopPriceItem')}
        <input type="text" inputMode="decimal" value={kr} onInput={(e) => setKr((e.currentTarget as HTMLInputElement).value)} />
      </label>
      {food && (
        <label>
          {t('unit')}
          <select value={unit} onChange={(e) => setUnit((e.currentTarget as HTMLSelectElement).value as PriceUnit)}>
            {priceUnits(props.units!).map((u) => (
              <option key={u} value={u}>
                kr/{u}
              </option>
            ))}
          </select>
        </label>
      )}
      <button type="submit" class="btn" disabled={!valid}>
        {tsh('shopSavePrice')}
      </button>
      {props.stored && (
        <button type="button" class="btn danger" onClick={props.onClear}>
          {tsh('shopClearPrice')}
        </button>
      )}
      {food && <p class="muted small block">{tsh('shopPriceHint')}</p>}
      {food && props.typical != null && !props.stored && <p class="muted small block">{tsh('shopTypical').replace('{kr}', fmt(props.typical))}</p>}
    </form>
  );
}
