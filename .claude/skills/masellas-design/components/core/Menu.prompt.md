Fixed, top-left section menu: square-cornered translucent tabs, lowercase labels; active tab is 50% black with white text.
```jsx
<Menu items={['the point','some words']} active={0} onSelect={setI} />
```
- Idle rgba(255,255,255,.5), hover .8 (hover wins over active, text goes black). `mobile`: 36px stacked blocks.
