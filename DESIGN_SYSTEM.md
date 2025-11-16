# 시간표 자동 생성 시스템 - Design System

## 🎨 컬러 팔레트

### Primary Colors
```css
--primary-50: #eff6ff;
--primary-100: #dbeafe;
--primary-200: #bfdbfe;
--primary-300: #93c5fd;
--primary-400: #60a5fa;
--primary-500: #3b82f6;  /* 메인 Primary */
--primary-600: #2563eb;
--primary-700: #1d4ed8;
--primary-800: #1e40af;
--primary-900: #1e3a8a;
```

### Secondary Colors
```css
--secondary-50: #f0f9ff;
--secondary-100: #e0f2fe;
--secondary-200: #bae6fd;
--secondary-300: #7dd3fc;
--secondary-400: #38bdf8;
--secondary-500: #0ea5e9;  /* 메인 Secondary */
--secondary-600: #0284c7;
--secondary-700: #0369a1;
```

### Neutral Colors
```css
--gray-50: #f9fafb;
--gray-100: #f3f4f6;
--gray-200: #e5e7eb;
--gray-300: #d1d5db;
--gray-400: #9ca3af;
--gray-500: #6b7280;
--gray-600: #4b5563;
--gray-700: #374151;
--gray-800: #1f2937;
--gray-900: #111827;
```

### Semantic Colors
```css
--success: #10b981;
--warning: #f59e0b;
--error: #ef4444;
--info: #3b82f6;
```

## 📝 Typography Scale

### Headings
```css
H1: 36px / 44px (font-weight: 700)
H2: 30px / 38px (font-weight: 700)
H3: 24px / 32px (font-weight: 600)
H4: 20px / 28px (font-weight: 600)
H5: 18px / 26px (font-weight: 600)
H6: 16px / 24px (font-weight: 600)
```

### Body Text
```css
Body Large: 18px / 28px (font-weight: 400)
Body: 16px / 24px (font-weight: 400)
Body Small: 14px / 20px (font-weight: 400)
Caption: 12px / 16px (font-weight: 400)
```

## 🎯 컴포넌트 스타일

### Buttons

#### Primary Button
```tsx
<button className="px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors shadow-sm">
  Primary Button
</button>
```

#### Secondary Button
```tsx
<button className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors">
  Secondary Button
</button>
```

#### Ghost Button
```tsx
<button className="px-6 py-3 text-primary-600 rounded-lg font-semibold hover:bg-primary-50 transition-colors">
  Ghost Button
</button>
```

#### Danger Button
```tsx
<button className="px-6 py-3 bg-error text-white rounded-lg font-semibold hover:bg-red-600 transition-colors">
  Danger Button
</button>
```

### Input Fields
```tsx
<input 
  type="text"
  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-primary-500 transition-colors"
  placeholder="입력하세요"
/>
```

### Select
```tsx
<select className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-primary-500 transition-colors">
  <option>선택하세요</option>
</select>
```

### Toggle Switch
```tsx
<label className="flex items-center gap-3 cursor-pointer">
  <input type="checkbox" className="sr-only peer" />
  <div className="w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-primary-600 transition-colors relative">
    <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full peer-checked:translate-x-5 transition-transform"></div>
  </div>
  <span>Toggle Label</span>
</label>
```

### Checkbox
```tsx
<label className="flex items-center gap-2 cursor-pointer">
  <input type="checkbox" className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500" />
  <span>Checkbox Label</span>
</label>
```

### Card
```tsx
<div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
  {/* Card Content */}
</div>
```

### Badge
```tsx
<span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-semibold">
  Badge
</span>
```

## 📐 레이아웃 시스템

### Container
```css
max-width: 1440px;
padding: 0 24px;
margin: 0 auto;
```

### Grid System
```css
/* 12-column grid */
grid-template-columns: repeat(12, minmax(0, 1fr));
gap: 24px;
```

### Spacing Scale
```css
--spacing-1: 4px;
--spacing-2: 8px;
--spacing-3: 12px;
--spacing-4: 16px;
--spacing-5: 20px;
--spacing-6: 24px;
--spacing-8: 32px;
--spacing-10: 40px;
--spacing-12: 48px;
--spacing-16: 64px;
```
