The brand's only interactive link: on hover a solid block wipes in behind the text via inset box-shadow (0.25s ease-in-out).
```jsx
<WipeLink href="cv.pdf">EN</WipeLink>
<WipeLink tone="dark" href="mailto:x">roger at lamosca.com</WipeLink>
```
- `tone="coral"` (on coral bg): charcoal text → bone on charcoal, padding grows 10→22px.
- `tone="dark"` (on charcoal bg): coral text → charcoal on bone, no padding.
- `strike`: line-through for unavailable/outdated items. `flush`: no padding.
