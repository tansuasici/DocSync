# Lessons Learned

Track corrections and mistakes here. Review at every session start.

---

## Format

```markdown
### [Short title]
- **Issue**: What went wrong
- **Root Cause**: Why it happened
- **Rule**: What to do differently going forward
```

---

## Example

### Edited wrong config file
- **Issue**: Changed `tsconfig.json` instead of `tsconfig.build.json`, broke the build
- **Root Cause**: Assumed there was only one tsconfig without checking
- **Rule**: Always `ls tsconfig*` before editing any TypeScript config

---

<!-- Add new lessons below this line -->

### npm publish onay gerektirir
- **Issue**: npm'e yayınlama kullanıcının açık onayı olmadan yapılmamalı
- **Root Cause**: Geri alınamaz, herkese açık bir aksiyon
- **Rule**: `npm publish` komutunu ASLA otomatik çalıştırma. Her zaman kullanıcıya sor ve onay bekle.
