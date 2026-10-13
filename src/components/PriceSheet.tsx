import { useState } from 'preact/hooks';
import { priceBook, setOwnPrice } from '../lib/cost';
import { deletePrice, putPrice } from '../lib/db';
import { lang } from '../lib/i18n';
import { foodName } from '../lib/nutrients';
import { servingsFor } from '../lib/servings';
import { krPerKg, type PriceUnit } from '../lib/shopping';
import { tsh } from '../lib/strings-shop';
import { back } from '../nav';
import { foods, userServings } from '../state';
import { numText, PriceForm } from './PriceForm';
import { Sheet } from './Sheet';

/** A food's price from the diary (M34): the shopping list's editor; the price is used in both. */
export default function PriceSheet({ foodRef }: { foodRef: string }) {
  const [failed, setFailed] = useState(false);
  const f = foods.value.get(foodRef);
  const units = f ? servingsFor(f, userServings.value.get(foodRef)) : [];
  const own = priceBook.value?.own.get(foodRef);
  const typical = priceBook.value?.typical.get(foodRef);

  const save = async (n: number, unit: PriceUnit) => {
    const k = krPerKg(n, unit, units);
    if (!k) return;
    try {
      await putPrice({ foodRef, krPerKg: k, updatedAt: Date.now() });
    } catch {
      return setFailed(true);
    }
    setOwnPrice(foodRef, k);
    back();
  };
  const clear = async () => {
    try {
      await deletePrice(foodRef);
    } catch {
      return setFailed(true);
    }
    setOwnPrice(foodRef, null);
    back();
  };

  return (
    <Sheet title={tsh('shopPrice')}>
      <div class="pad">
        <h3>{f ? foodName(f, lang.value) : '…'}</h3>
        <PriceForm units={units} initial={own != null ? numText(own) : ''} stored={own != null} typical={typical} onSave={save} onClear={() => void clear()} />
        {failed && (
          <p class="warn small" role="alert">
            {tsh('shopSaveFailed')}
          </p>
        )}
        <p class="muted small">{tsh('priceEverywhere')}</p>
      </div>
    </Sheet>
  );
}
