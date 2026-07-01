import { createContext, useContext, useReducer } from 'react'

const CartContext = createContext(null)

const initialState = {
  items: [],       // { productId, variantId, vendorId, name, variantSnapshot, priceCents, quantity, fulfillmentMethod }
  couponCode: null,
  discountCents: 0,
  miniCartOpen: false,
}

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.items.findIndex(
        i => i.variantId === action.item.variantId
      )
      if (existing >= 0) {
        const items = [...state.items]
        items[existing] = {
          ...items[existing],
          quantity: items[existing].quantity + (action.item.quantity ?? 1),
        }
        return { ...state, items, miniCartOpen: true }
      }
      return {
        ...state,
        items: [...state.items, { ...action.item, quantity: action.item.quantity ?? 1 }],
        miniCartOpen: true,
      }
    }
    case 'UPDATE_QUANTITY': {
      if (action.quantity <= 0) {
        return { ...state, items: state.items.filter(i => i.variantId !== action.variantId) }
      }
      return {
        ...state,
        items: state.items.map(i =>
          i.variantId === action.variantId ? { ...i, quantity: action.quantity } : i
        ),
      }
    }
    case 'REMOVE_ITEM':
      return { ...state, items: state.items.filter(i => i.variantId !== action.variantId) }
    case 'SET_COUPON':
      return { ...state, couponCode: action.code, discountCents: action.discountCents }
    case 'OPEN_MINI_CART':
      return { ...state, miniCartOpen: true }
    case 'CLOSE_MINI_CART':
      return { ...state, miniCartOpen: false }
    case 'CLEAR':
      return initialState
    default:
      return state
  }
}

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(cartReducer, initialState)

  // Items grouped by vendor — needed for cart UI and Stripe Connect splitting
  const itemsByVendor = state.items.reduce((acc, item) => {
    if (!acc[item.vendorId]) acc[item.vendorId] = []
    acc[item.vendorId].push(item)
    return acc
  }, {})

  const subtotalCents = state.items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0)
  const itemCount = state.items.reduce((sum, i) => sum + i.quantity, 0)

  const value = {
    items: state.items,
    itemsByVendor,
    couponCode: state.couponCode,
    discountCents: state.discountCents,
    subtotalCents,
    itemCount,
    miniCartOpen: state.miniCartOpen,
    addItem: (item) => dispatch({ type: 'ADD_ITEM', item }),
    updateQuantity: (variantId, quantity) => dispatch({ type: 'UPDATE_QUANTITY', variantId, quantity }),
    removeItem: (variantId) => dispatch({ type: 'REMOVE_ITEM', variantId }),
    setCoupon: (code, discountCents) => dispatch({ type: 'SET_COUPON', code, discountCents }),
    openMiniCart: () => dispatch({ type: 'OPEN_MINI_CART' }),
    closeMiniCart: () => dispatch({ type: 'CLOSE_MINI_CART' }),
    clearCart: () => dispatch({ type: 'CLEAR' }),
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export const useCart = () => {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
