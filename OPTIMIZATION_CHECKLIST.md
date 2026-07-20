# CareNest Performance Optimization Checklist

## ✅ Already Completed
- [x] Vite configuration optimized (code splitting, minification, dependency optimization)
- [x] Performance utility functions created (`src/utils/performanceUtils.js`)
- [x] Memoized React components created (`src/components/OptimizedComponents.jsx`)
- [x] React lazy loading implemented (pages already use `lazy()` and `Suspense`)

---

## 🔧 TODO: Implementation Tasks

### 1. Database Query Optimization (HIGH PRIORITY - 30-60 mins)
**File: `src/firebase/orderService.js`**

```javascript
// ⚠️ CURRENT: Loads ALL orders in real-time
export function subscribeToCustomerOrders(customerUid, onNext, onError) {
  return onSnapshot(
    query(ordersRef, where('customerUid', '==', customerUid)),
    // ^^^ This loads ALL orders at once
    (snapshot) => { ... }
  )
}

// ✅ OPTIMIZED: Add limit(50) to load only recent orders
import { limit } from 'firebase/firestore'

export function subscribeToCustomerOrders(customerUid, onNext, onError) {
  return onSnapshot(
    query(
      ordersRef, 
      where('customerUid', '==', customerUid),
      orderBy('createdAt', 'desc'),
      limit(50)  // ← ADD THIS
    ),
    (snapshot) => { ... }
  )
}
```

**Impact:** 50-70% faster for customers with many orders

---

### 2. Form Input Debouncing (MEDIUM PRIORITY - 15 mins)
**File: `src/pages/customer/CustomerAppPage.jsx`**

Use the `debounce` function from `src/utils/performanceUtils.js`:

```javascript
import { debounce } from '../../utils/performanceUtils'

// Wrap form change handlers with debounce
const handleFormChange = debounce((fieldName, value) => {
  setForms(current => ({
    ...current,
    [currentServiceType]: {
      ...current[currentServiceType],
      [fieldName]: value
    }
  }))
}, 300)
```

**Impact:** Reduces unnecessary re-renders while typing

---

### 3. Enable Firebase Offline Persistence (MEDIUM PRIORITY - 10 mins)
**File: `src/firebase/firebaseConfig.js`**

```javascript
import { enableIndexedDbPersistence } from 'firebase/firestore'
import { db } from './firebaseConfig'

// Add after db initialization
enableIndexedDbPersistence(db).catch(err => {
  if (err.code === 'failed-precondition') {
    console.log('Multiple tabs open, persistence disabled')
  } else if (err.code === 'unimplemented') {
    console.log('Browser doesn\'t support persistence')
  }
})
```

**Impact:** App works offline, loads faster on repeat visits

---

### 4. Create Firebase Composite Indexes (MEDIUM PRIORITY - 5 mins)
**File: `firestore.rules` or Firebase Console**

When you see warnings in browser console like:
```
"The query requires an index..."
```

Click the link or go to Firebase Console → Firestore → Indexes and create:

**Index 1:** Collection: `serviceRequests`
- Field: `customerUid` (Ascending)
- Field: `createdAt` (Descending)

**Index 2:** Collection: `serviceRequests`
- Field: `providerUid` (Ascending)  
- Field: `createdAt` (Descending)

**Impact:** Database queries 10x faster

---

### 5. Optimize Image Assets (LOW PRIORITY - optional)
**Files: `public/logo.svg`, profile photos**

Use online tools:
- SVG: [SVGO](https://jakearchibald.github.io/svgo-gui/) - compress SVG
- PNG/JPG: [TinyPNG](https://tinypng.com) or [ImageOptim](https://imageoptim.com/)
- Recommend WebP format where browser support exists

**Impact:** 10-30KB reduction per image

---

### 6. Lazy Load Profile Photos (LOW PRIORITY - 30 mins)
**File: `src/pages/customer/CustomerAppPage.jsx`**

```javascript
// Add loading="lazy" to img tags
<img 
  src={profile.photoURL} 
  alt={`${customerName}'s profile`}
  loading="lazy"  // ← ADD THIS
/>
```

**Impact:** Faster initial page load

---

### 7. Configure Vercel Cache Headers (LOW PRIORITY - 5 mins)
**File: `vercel.json`** (add if not present)

```json
{
  "headers": [
    {
      "source": "/public/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

**Impact:** Browser caches static assets for 1 year

---

## 🧪 Testing & Measurement

### Measure Performance (after each optimization)

1. **Chrome DevTools → Lighthouse**
   - Open DevTools (F12)
   - Go to "Lighthouse" tab
   - Click "Analyze page load"
   - Look for Performance score (target: >90)

2. **Bundle Size Check**
   ```bash
   npm run build
   # Check output size in terminal
   ```

3. **Monitor Real-Time Performance**
   - Open DevTools → Performance tab
   - Click record, perform action, stop
   - Look for long tasks (> 50ms)

### Performance Targets

| Metric | Target | How to Check |
|--------|--------|-------------|
| First Contentful Paint | < 1.5s | Lighthouse |
| Largest Contentful Paint | < 2.5s | Lighthouse |
| Bundle Size | < 250KB | `npm run build` output |
| Database Query Time | < 1s | Firestore Console Stats |

---

## 📋 Implementation Order

**Day 1 (Quick wins - 1 hour):**
1. ✅ Database query optimization (limit to 50 orders)
2. ✅ Create Firebase composite indexes
3. ✅ Enable offline persistence

**Day 2 (Polish - 1 hour):**
4. Form input debouncing
5. Lazy load images
6. Optimize SVG logos

**Day 3 (Optional refinements):**
7. Configure Vercel cache headers
8. Image compression/WebP conversion
9. Advanced code splitting

---

## 🚀 Deploy & Monitor

After implementing optimizations:

```bash
npm run build        # Check for warnings
npm run preview      # Test locally
npm run lint        # Check for errors
git add .
git commit -m "Performance optimizations: database limits, debouncing, offline persistence"
git push            # Vercel auto-deploys
```

Monitor in Vercel:
- Analytics → Web Vitals
- Look for improvement in Core Web Vitals scores

---

## 💡 Pro Tips

1. **Use React DevTools Profiler** - Find which components render slowly
2. **Monitor Network Tab** - Check file sizes, cache hits
3. **Use Lighthouse Regularly** - Before each release
4. **Test on Slow Network** - DevTools → Throttling → Slow 3G
5. **Check Bundle Size** - Each library adds weight

---

## Questions?

If you get stuck on any optimization:
1. Check browser console for warnings/errors
2. Look at Firestore emulator logs: `firebase emulators:start`
3. Test changes locally first before pushing to production
