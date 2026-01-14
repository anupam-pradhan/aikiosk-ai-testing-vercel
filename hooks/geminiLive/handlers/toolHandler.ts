// Tool call handler - executes tool calls from Gemini AI

import { MutableRefObject } from "react";
import { SelectedModifier } from "../../../types";
import {
  findCategoryByNameLoose,
  isLikelyPureCategoryRequest,
  resolveItemInfo,
  getSafeVariantId,
  buildAddBaseKey,
  inferClosestCategoryFromAnyPhrase,
  inferCategoryFromItemPhrase,
  normalize,
} from "../utils";
import {
  ANIMATION_DELAY_MS,
  UI_SYNC_DELAY_MS,
  CATEGORY_SWITCH_DELAY_MS,
} from "../constants";

export const createToolHandler = (
  orderContextRef: MutableRefObject<any>,
  processedToolIds: MutableRefObject<Set<string>>,
  isDuplicateAddWithinWindow: (baseKey: string) => boolean,
  activeSessionPromiseRef: MutableRefObject<Promise<any> | null>,
  isSessionActive: MutableRefObject<boolean>,
  disconnect: () => void,
  triggerAnimation: (itemId: string) => void,
  dlog: (...args: any[]) => void,
  dwarn: (...args: any[]) => void,
  derr: (...args: any[]) => void
) => {
  const handleToolCall = async (fc: any) => {
    dlog("Tool Call:", fc?.name, fc?.args, fc?.id);

    // ID-based dedupe
    if (fc.id) {
      if (processedToolIds.current.has(fc.id)) {
        dwarn(`Duplicate tool call ignored: ${fc.name} (${fc.id})`);
        return;
      }
      processedToolIds.current.add(fc.id);
    }

    const ctx = orderContextRef.current;
    let result = "Done";

    if (fc.name === "stopListening") {
      dlog("User requested to stop listening");
      result = "MICROPHONE_STOPPED";
      setTimeout(() => {
        disconnect();
      }, 100);
    }

    // ---------------- addToCart ----------------
    if (fc.name === "addToCart") {
      const { itemName, variantName } = fc.args || {};
      const modifiers = fc.args?.modifiers;
      const quantity = fc.args?.quantity ? Number(fc.args?.quantity) : 1;
      const note = String(fc.args?.note || "").trim();
      const mode = String(fc.args?.mode || "add").toLowerCase();

      const rawName = String(itemName || "").trim();
      const qtyToAdd = quantity;
      let finalItemNote = note;

      dlog("addToCart tool call:", {
        itemName,
        variantName,
        modifiers,
        quantity,
        note,
      });

      const baseKey = buildAddBaseKey(fc.args || {});
      if (baseKey && isDuplicateAddWithinWindow(baseKey)) {
        dwarn("Suppressed duplicate addToCart within window:", {
          baseKey,
          args: fc.args,
        });
        result = `DUPLICATE_ADD_IGNORED:${rawName}`;
      } else if (!rawName) {
        result = "ITEM_NOT_FOUND:";
      } else {
        const directCategory = findCategoryByNameLoose(ctx, rawName);

        let shouldTreatAsCategory =
          !!directCategory &&
          isLikelyPureCategoryRequest(rawName, directCategory.name);

        if (directCategory && !shouldTreatAsCategory) {
          const normRaw = normalize(rawName);
          const normCat = normalize(directCategory.name);
          const catWords = normCat.split(" ");
          // If user says "Add [Category]", treat as category
          if (
            normRaw.includes(normCat) ||
            catWords.every((w) => normRaw.includes(w))
          ) {
            const verbs = ["add", "want", "buy", "get", "have"];
            const words = normRaw.split(" ");
            // If mostly just verbs + category name, treat as category
            const nonCatWords = words.filter(
              (w) => !normCat.includes(w) && !verbs.includes(w)
            );
            if (nonCatWords.length === 0) {
              shouldTreatAsCategory = true;
            }
          }
        }

        dlog("Category candidate check:", {
          rawName,
          matchedCategory: directCategory?.name,
          shouldTreatAsCategory,
        });

        if (shouldTreatAsCategory && directCategory) {
          try {
            ctx.setSelectedCategory(directCategory);
          } catch (e) {
            derr("Error switching category", e);
          }
          result = `CATEGORY_SHOWN:${directCategory.name}`;
          return;
        } else {
          let itemInfo = null;
          const activeItem = ctx.activeItem;
          const normRaw = normalize(rawName);

          if (activeItem) {
            const normActive = normalize(activeItem.name);
            const isGeneric =
              !rawName ||
              [
                "item",
                "it",
                "this",
                "that",
                "withme",
                "withmeal",
                "with",
              ].includes(normRaw);

            const matchesActive =
              normActive.includes(normRaw) || normRaw.includes(normActive);

            const variantMatches = activeItem.variantlist?.some(
              (v: any) =>
                normalize(v.name).includes(normRaw) ||
                normRaw.includes(normalize(v.name))
            );

            if (isGeneric || matchesActive || variantMatches) {
              dlog("Using context-active item:", activeItem.name);
              itemInfo = { item: activeItem, category: ctx.selectedCategory };
            }
          }

          if (!itemInfo) {
            itemInfo = resolveItemInfo(ctx, rawName, dlog);
          }

          if (!itemInfo?.item) {
            dlog("Item NOT resolved:", rawName);
            const inferredCat =
              inferClosestCategoryFromAnyPhrase(ctx, rawName) ||
              inferCategoryFromItemPhrase(ctx, rawName) ||
              findCategoryByNameLoose(ctx, rawName);

            dlog("Item not found → category inference:", {
              rawName,
              inferred: inferredCat?.name || null,
            });

            if (inferredCat) {
              try {
                ctx.setSelectedCategory(inferredCat);
              } catch (e) {
                derr("Error setting inferred category", e);
              }
              result = `ITEM_NOT_FOUND_CATEGORY_SHOWN:${rawName}->${inferredCat.name}`;
            } else {
              result = `ITEM_NOT_FOUND:${rawName}`;
            }
          } else {
            const { item, category } = itemInfo;
            if (category && category.id !== ctx.selectedCategory?.id) {
              try {
                ctx.setSelectedCategory(category);
                dlog("Auto-switched to category:", category.name);
                // Wait for category to render
                await new Promise((resolve) =>
                  setTimeout(resolve, CATEGORY_SWITCH_DELAY_MS)
                );
              } catch (e) {
                derr("Error switching to item category", e);
              }
            }

            const variants = Array.isArray(item.variantlist)
              ? item.variantlist
              : [];
            const hasVariantChoice = variants.length > 1;

            dlog("Resolved item:", {
              name: item?.name,
              variants: variants.length,
              hasVariantChoice,
            });

            if (hasVariantChoice && !variantName) {
              try {
                if (mode === "show") {
                  if (typeof ctx.highlightItem === "function")
                    ctx.highlightItem(item);
                  result = `SHOWING_ITEM:${item.name}`;
                } else {
                  if (item.id) {
                    triggerAnimation(item.id);
                    await new Promise((resolve) =>
                      setTimeout(resolve, ANIMATION_DELAY_MS)
                    );
                  }
                  ctx.startItemFlow(item);
                  await new Promise((resolve) =>
                    setTimeout(resolve, UI_SYNC_DELAY_MS)
                  );
                  if (
                    fc.args?.note &&
                    typeof ctx.setActiveNote === "function"
                  ) {
                    ctx.setActiveNote(String(fc.args.note));
                  }
                  const validOptionNames = variants
                    .map((v: any) => v.name)
                    .join(", ");
                  result = `SELECT_VARIANT:${item.name} (Options: ${validOptionNames}). SCREEN_READY. NOW_ASK_VARIANT`;
                }
              } catch (e) {
                derr("startItemFlow error (variant)", e);
                result = `ERROR_OPENING_VARIANT:${item.name}`;
              }
            } else {
              let targetVariant: any | null = null;

              if (variantName) {
                targetVariant =
                  variants.find((v: any) =>
                    normalize(v.name).includes(normalize(String(variantName)))
                  ) || null;

                if (!targetVariant) {
                  if (item.id) {
                    triggerAnimation(item.id);
                    await new Promise((resolve) =>
                      setTimeout(resolve, ANIMATION_DELAY_MS)
                    );
                  }
                  try {
                    ctx.startItemFlow(item);
                  } catch (e) {
                    derr("startItemFlow error (variant mismatch)", e);
                  }
                  result = `VARIANT_MISMATCH:${item.name}`;
                }
              }

              if (!result.startsWith("VARIANT_MISMATCH")) {
                if (!targetVariant) {
                  targetVariant = (variants[0] as any) || null;
                }

                const modifierGroups =
                  (targetVariant as any)?.modifierlist &&
                  Array.isArray((targetVariant as any).modifierlist)
                    ? (targetVariant as any).modifierlist
                    : [];

                const hasModifiers = modifierGroups.some(
                  (g: any) => Array.isArray(g.list) && g.list.length > 0
                );

                dlog("Variant/modifiers status:", {
                  variant: targetVariant?.name || "(none)",
                  hasModifiers,
                  modifiersProvided: modifiers !== undefined,
                });

                const isAlreadyActive =
                  ctx.activeItem?.id === item.id ||
                  ctx.highlightedItemId === item.id;

                if (hasModifiers && modifiers === undefined) {
                  try {
                    if (mode === "show" && !isAlreadyActive) {
                      if (typeof ctx.highlightItem === "function")
                        ctx.highlightItem(item);
                      result = `SHOWING_ITEM:${item.name}`;
                    } else {
                      dlog("Opening modifier flow for:", item.name);
                      if (item.id) {
                        triggerAnimation(item.id);
                        await new Promise((resolve) =>
                          setTimeout(resolve, ANIMATION_DELAY_MS)
                        );
                      }
                      ctx.startItemFlow(item);
                      await new Promise((resolve) =>
                        setTimeout(resolve, UI_SYNC_DELAY_MS)
                      );
                      if (
                        typeof ctx.selectVariant === "function" &&
                        targetVariant
                      ) {
                        if (targetVariant.id) {
                          triggerAnimation(targetVariant.id);
                          await new Promise((resolve) =>
                            setTimeout(resolve, ANIMATION_DELAY_MS)
                          );
                        }
                        ctx.selectVariant(targetVariant);
                        await new Promise((resolve) =>
                          setTimeout(resolve, UI_SYNC_DELAY_MS)
                        );
                      }
                      if (
                        fc.args?.note &&
                        typeof ctx.setActiveNote === "function"
                      ) {
                        ctx.setActiveNote(String(fc.args.note));
                      }

                      const groupsSummary: string[] = [];
                      const freeModifiers: string[] = [];

                      for (const group of modifierGroups) {
                        if (
                          group.list &&
                          Array.isArray(group.list) &&
                          group.list.length > 0
                        ) {
                          const groupName =
                            group.group_name || group.name || "Options";
                          const modNames = group.list
                            .slice(0, 4)
                            .map((m: any) => m.name)
                            .join(", ");
                          groupsSummary.push(`${groupName}: ${modNames}`);

                          // Collect free items as before
                          for (const mod of group.list) {
                            if (Number(mod.price || 0) === 0)
                              freeModifiers.push(mod.name);
                          }
                        }
                      }

                      const modList =
                        groupsSummary.length > 0
                          ? ` (Groups: ${groupsSummary.join(" | ")})`
                          : "";

                      const freeList =
                        freeModifiers.length > 0
                          ? ` [FREE: ${freeModifiers.join(", ")}]`
                          : "";

                      result = `SELECT_MODIFIERS:${targetVariant?.name || ""} ${
                        item.name
                      }${modList}${freeList}. SCREEN_READY. NOW_ASK_MODIFIERS`.trim();
                    }
                  } catch (e) {
                    derr("open modifiers UI error", e);
                    result = `ERROR_OPENING_MODIFIERS:${item.name}`;
                  }
                } else {
                  if (modifiers !== undefined && targetVariant) {
                    const selectedModifiers: SelectedModifier[] = [];
                    const missingModifiers: string[] = [];

                    for (const modName of modifiers || []) {
                      const rawModInput = String(modName);
                      let found = false;

                      for (const group of modifierGroups) {
                        const mod =
                          group.list?.find((m: any) =>
                            normalize(m.name).includes(
                              normalize(String(modName))
                            )
                          ) || null;

                        if (mod) {
                          selectedModifiers.push({
                            id: mod.id,
                            groupId: group.id,
                            groupName: group.group_name || group.name,
                            name: mod.name,
                            price: mod.price,
                            modqty: 1,
                          });
                          found = true;
                          break;
                        }
                      }
                      if (!found) {
                        for (const group of modifierGroups) {
                          const embeddedMod =
                            group.list?.find((m: any) =>
                              normalize(rawModInput).includes(normalize(m.name))
                            ) || null;

                          if (embeddedMod) {
                            dlog(
                              `Found embedded modifier: ${embeddedMod.name} inside "${rawModInput}"`
                            );

                            if (
                              !selectedModifiers.some(
                                (sm) => sm.id === embeddedMod.id
                              )
                            ) {
                              selectedModifiers.push({
                                id: embeddedMod.id,
                                groupId: group.id,
                                groupName: group.group_name || group.name,
                                name: embeddedMod.name,
                                price: embeddedMod.price,
                                modqty: 1,
                              });
                            }

                            let remainder = rawModInput
                              .replace(new RegExp(embeddedMod.name, "gi"), "")
                              .trim();

                            remainder = remainder
                              .replace(/^\s*(with|and)\s+/i, "")
                              .trim();

                            if (remainder.length > 0) {
                              missingModifiers.push(remainder);
                            }

                            found = true;
                            break;
                          }
                        }
                      }

                      if (!found) {
                        missingModifiers.push(rawModInput);
                      }
                    }
                    if (missingModifiers.length > 0) {
                      const missingStr = missingModifiers.join(", ");
                      dlog("Modifiers/Notes to append:", missingStr);
                      if (finalItemNote) {
                        finalItemNote += `, ${missingStr}`;
                      } else {
                        finalItemNote = missingStr;
                      }
                    }

                    const variantId = getSafeVariantId(item, targetVariant);

                    dlog("Attempt addToCart (with modifiers):", {
                      item: item.name,
                      variantId,
                      qtyToAdd,
                      selectedCount: selectedModifiers.length,
                      missingModifiers,
                    });

                    try {
                      if (typeof ctx.addToCart === "function") {
                        ctx.addToCart(
                          item,
                          variantId,
                          selectedModifiers,
                          qtyToAdd,
                          finalItemNote
                        );
                        result = `ADDED:${item.name}. SCREEN_READY. MUST_ASK: "Anything else?"`;
                      } else {
                        result = "ERROR:addToCart not available";
                      }

                      if (typeof ctx.cancelFlow === "function")
                        ctx.cancelFlow();
                      if (typeof ctx.setActiveNote === "function")
                        ctx.setActiveNote("");

                      dlog(
                        `✅ Successfully added ${item.name} to cart with ${selectedModifiers.length} modifiers`
                      );
                    } catch (e) {
                      derr("❌ addToCart error (modifiers path)", e);
                      result = `ADD_FAILED:${item.name}`;
                    }
                  } else {
                    const allowDuplicate = fc.args?.allowDuplicate === true;
                    const existingCartItem =
                      !allowDuplicate && mode === "add"
                        ? ctx.cart?.find(
                            (c: any) =>
                              normalize(c.name) === normalize(item.name) ||
                              c.id === item.id
                          )
                        : null;

                    if (existingCartItem) {
                      dlog("Duplicate detected:", item.name);
                      result = `ITEM_ALREADY_IN_CART:${item.name}. ASK_USER: "You already have ${item.name}. Do you want to add another one, or change the existing one?"`;
                    } else {
                      const hasVariants = item.variantlist?.length > 1;
                      let hasMods = false;
                      let singleVar = null;

                      if (
                        !hasVariants &&
                        item.variantlist &&
                        item.variantlist.length > 0
                      ) {
                        singleVar = item.variantlist[0];
                        const modGroups =
                          (singleVar as any).modifierlist ||
                          (singleVar as any).modifierList ||
                          [];
                        hasMods = modGroups.some(
                          (g: any) => g.list && g.list.length > 0
                        );
                      }

                      const shouldOpenFlow =
                        hasVariants || hasMods || isAlreadyActive;

                      if (hasVariants) {
                        if (item.id) {
                          triggerAnimation(item.id);
                          await new Promise((resolve) =>
                            setTimeout(resolve, ANIMATION_DELAY_MS)
                          );
                        }
                        ctx.startItemFlow(item);

                        const variantNames = item.variantlist
                          .map((v: any) => v.name)
                          .join(", ");
                        result = `SELECT_VARIANT:${item.name} (Options: ${variantNames})`;
                      } else if (hasMods) {
                        if (item.id) {
                          triggerAnimation(item.id);
                          await new Promise((resolve) =>
                            setTimeout(resolve, ANIMATION_DELAY_MS)
                          );
                        }
                        ctx.startItemFlow(item);
                        result = `SELECT_MODIFIERS:${item.name}`;
                      } else if (mode === "add") {
                        const note = String(fc.args?.note || "").trim();
                        try {
                          ctx.addToCart(
                            item,
                            singleVar?.id || item.variantlist[0]?.id,
                            [],
                            qtyToAdd,
                            note
                          );
                          ctx.setHighlightedItemId(null);
                          if (typeof ctx.setActiveNote === "function")
                            ctx.setActiveNote("");
                          dlog(`✅ added simple item ${item.name}`);
                          result = `ADDED:${item.name}. SCREEN_READY. MUST_ASK: "Anything else?"`;
                        } catch (e) {
                          derr("add simple error", e);
                          result = "ADD_FAILED";
                        }
                      } else {
                        if (typeof ctx.highlightItem === "function")
                          ctx.highlightItem(item);
                        result = `SHOWING_ITEM:${item.name}`;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    // ---------------- clearCart ----------------
    else if (fc.name === "clearCart") {
      try {
        if (typeof ctx.clearCart === "function") {
          ctx.clearCart();
        }

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("close-cart-mobile"));
        }

        result = "CART_CLEARED_AND_CLOSED";
      } catch (e) {
        derr("clearCart error", e);
        result = "Clear cart failed";
      }
    }

    // ---------------- editCartItem ----------------
    else if (fc.name === "editCartItem") {
      const itemName = fc.args?.itemName;
      const variantName = fc.args?.variantName;
      const multipliers = fc.args?.modifierUpdates || [];
      const simpleAdds = fc.args?.modifiersToAdd || [];
      const itemNote = fc.args?.note;

      if (ctx.cart) {
        const cartItem =
          ctx.cart.find(
            (i: any) => normalize(i.name) === normalize(itemName)
          ) ||
          ctx.cart.find((i: any) =>
            normalize(i.name).includes(normalize(itemName))
          );

        if (cartItem) {
          if (cartItem.id) triggerAnimation(cartItem.id);
          const itemInfo = resolveItemInfo(ctx, cartItem.name, dlog);
          if (
            itemInfo?.item &&
            typeof ctx.updateCartItemModifiers === "function"
          ) {
            try {
              let currentVariantId = cartItem.variantId;
              let updatedToBase: number | null = null;

              if (variantName) {
                const targetV = itemInfo.item.variantlist.find(
                  (v: any) =>
                    normalize(v.name) === normalize(variantName) ||
                    normalize(v.name).includes(normalize(variantName))
                );

                if (targetV && targetV.id !== cartItem.variantId) {
                  if (typeof ctx.updateCartItemVariant === "function") {
                    ctx.updateCartItemVariant(
                      cartItem.cartId,
                      targetV.id,
                      targetV.name,
                      Number(targetV.price)
                    );
                    currentVariantId = targetV.id;
                    updatedToBase = Number(targetV.price);
                    result = `UPDATED_VARIANT:${cartItem.name} now "${targetV.name}". `;
                  }
                }
              }

              const variant =
                itemInfo.item.variantlist.find(
                  (v: any) => v.id === currentVariantId
                ) || itemInfo.item.variantlist[0];
              const modGroups =
                (variant as any).modifierlist ||
                (variant as any).modifierList ||
                [];

              let newModifiers = [...(cartItem.modifiers || [])];
              let finalItemNote = cartItem.note || "";
              if (itemNote) finalItemNote = itemNote;

              let addedNames: string[] = [];
              let removedNames: string[] = [];
              let handledAsNote: string[] = [];

              const findModDef = (name: string) => {
                for (const group of modGroups) {
                  const match = group.list.find(
                    (m: any) => normalize(m.name) === normalize(name)
                  );
                  if (match) return { mod: match, group };
                }
                return null;
              };

              for (const update of multipliers) {
                const def = findModDef(update.name);
                if (def) {
                  const idx = newModifiers.findIndex(
                    (m: any) => m.id === def.mod.id
                  );
                  if (update.quantity <= 0) {
                    if (idx > -1) {
                      newModifiers.splice(idx, 1);
                      removedNames.push(update.name);
                    }
                  } else {
                    if (idx > -1) {
                      newModifiers[idx] = {
                        ...newModifiers[idx],
                        modqty: update.quantity,
                      };
                    } else {
                      newModifiers.push({
                        id: def.mod.id,
                        name: def.mod.name,
                        price: Number(def.mod.price),
                        modqty: update.quantity,
                        groupId: def.group.id,
                      });
                    }
                    addedNames.push(`${update.name} (x${update.quantity})`);
                  }
                } else {
                  if (update.quantity > 0) {
                    handledAsNote.push(`${update.name} x${update.quantity}`);
                    finalItemNote +=
                      (finalItemNote ? ", " : "") +
                      `${update.name} x${update.quantity}`;
                  } else {
                    const noteParts = finalItemNote
                      .split(",")
                      .map((s) => s.trim());

                    const partToRemove = noteParts.find((p) => {
                      const pLower = p.toLowerCase();
                      const qLower = update.name.toLowerCase();

                      if (pLower.includes(qLower)) return true;

                      const qTokens = qLower
                        .split(/\s+/)
                        .filter((t) => t.length > 2);
                      if (qTokens.length > 0) {
                        return qTokens.some((token) => pLower.includes(token));
                      }
                      return false;
                    });

                    if (partToRemove) {
                      finalItemNote = noteParts
                        .filter((p) => p !== partToRemove)
                        .join(", ");
                      removedNames.push(`Note: ${partToRemove}`);
                    } else {
                      // Optional: Report failure to AI?
                      // removedNames.push(`FAILED: ${update.name}`);
                      // Better to fail silently or let AI assume success?
                      // If we report failure, AI can correct itself.
                      // But let's stick to silent unless we want verbose error logs.
                    }
                  }
                }
              }

              for (const modName of simpleAdds) {
                const def = findModDef(modName);
                if (def) {
                  const idx = newModifiers.findIndex(
                    (m: any) => m.id === def.mod.id
                  );
                  if (idx === -1) {
                    newModifiers.push({
                      id: def.mod.id,
                      name: def.mod.name,
                      price: Number(def.mod.price),
                      modqty: 1,
                      groupId: def.group.id,
                    });
                    addedNames.push(def.mod.name);
                  }
                } else {
                  handledAsNote.push(modName);
                  finalItemNote += (finalItemNote ? ", " : "") + modName;
                }
              }

              let variantUpdated = !!updatedToBase;
              let hasChanges =
                variantUpdated ||
                addedNames.length > 0 ||
                removedNames.length > 0 ||
                handledAsNote.length > 0 ||
                finalItemNote !== cartItem.note;

              if (hasChanges) {
                if (typeof ctx.updateCartItemModifiers === "function") {
                  ctx.updateCartItemModifiers(cartItem.cartId, newModifiers);
                }
                if (finalItemNote !== cartItem.note)
                  ctx.updateCartItemNote(cartItem.cartId, finalItemNote);

                let feedback = "";
                if (result && result.startsWith("UPDATED_VARIANT")) {
                  feedback += result;
                }

                if (addedNames.length)
                  feedback += `Added: ${addedNames.join(", ")}. `;
                if (removedNames.length)
                  feedback += `Removed: ${removedNames.join(", ")}. `;
                if (handledAsNote.length)
                  feedback += `Notes: ${handledAsNote.join(", ")}. `;
                if (finalItemNote !== cartItem.note)
                  feedback += `Note updated.`;

                result = `CHANGES_SAVED: ${feedback.trim()}`;
              } else {
                result = `NO_CHANGES_MADE:${cartItem.name}`;
              }
            } catch (e) {
              derr("smart edit error", e);
              result = "EDIT_FAILED";
            }
          } else {
            result = "ITEM_DETAILS_NOT_FOUND";
          }
        } else {
          result = `CART_ITEM_NOT_FOUND:${itemName}`;
        }
      }
    }

    // ---------------- showCart ----------------
    else if (fc.name === "showCart") {
      try {
        if (typeof ctx.showCartScreen === "function") {
          ctx.showCartScreen();
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("open-cart-mobile"));
          }
        }

        const cart = ctx.cart || [];
        const calculatedTotal = cart.reduce((sum: number, item: any) => {
          return sum + (item.total || 0);
        }, 0);

        const total = (calculatedTotal / 100).toFixed(2);
        const itemNames = cart
          .map((i: any) => {
            const mods =
              i.modifiers && i.modifiers.length > 0
                ? ` (+${i.modifiers.map((m: any) => m.name).join(", ")})`
                : "";
            return `${i.qty}x ${i.name}${mods}`;
          })
          .join(", ");

        result = `OPENED_CART_DRAWER: Success. Cart Items: [${itemNames}]. Total: £${total}`;
      } catch (e) {
        derr("showCart error", e);
        result = "Show cart failed";
      }
    }

    // ---------------- showPaymentOptions ----------------
    else if (fc.name === "showPaymentOptions") {
      try {
        if (typeof ctx.showCartScreen === "function") {
          ctx.showCartScreen();
        }

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("open-cart-mobile"));
          window.dispatchEvent(new CustomEvent("show-payment-options"));
        }

        await new Promise((resolve) => setTimeout(resolve, UI_SYNC_DELAY_MS));

        const cart = ctx.cart || [];
        const total = cart.reduce(
          (sum: number, item: any) => sum + (item.total || 0),
          0
        );
        const formattedTotal = (total / 100).toFixed(2);

        result = `PAYMENT_OPTIONS_SHOWN. Cart total: £${formattedTotal}. SCREEN_READY. NOW_ASK: "Would you like to pay by card or cash?"`;
      } catch (e) {
        derr("showPaymentOptions error", e);
        result = "ERROR_SHOWING_PAYMENT_OPTIONS";
      }
    }

    // ---------------- setPaymentMethod ----------------
    else if (fc.name === "setPaymentMethod") {
      const method = fc.args?.paymentMethod;
      if (method === "cash" || method === "card") {
        try {
          ctx.setPaymentMethod(method);
          result = `PAYMENT_SET:${method}`;
        } catch (e) {
          derr("setPaymentMethod error", e);
          result = "PAYMENT_SET_FAILED";
        }
      } else {
        result = "PAYMENT_METHOD_INVALID";
      }
    }

    // ---------------- checkout ----------------
    else if (fc.name === "checkout") {
      try {
        const method = fc.args?.paymentMethod;
        const ctx = orderContextRef.current;

        const chosen: "cash" | "card" = method === "card" ? "card" : "cash";

        try {
          ctx.setPaymentMethod(chosen);
        } catch (e) {
          derr(`setPaymentMethod(${chosen}) inside checkout failed`, e);
        }

        if (chosen === "card") {
          try {
            ctx.setCardStatus("processing");
          } catch (e) {
            derr("setCardStatus(processing) failed", e);
          }
        }

        const orderRes = await ctx.placeOrder(chosen);

        if (chosen === "card") {
          if (orderRes) {
            ctx.setCardStatus("idle");
          } else {
            ctx.setCardStatus("failed");
          }
        }

        if (orderRes && orderRes.order_number) {
          result = `ORDER_SUBMITTED:${orderRes.order_number}`;
        } else if (orderRes) {
          result = "ORDER_SUBMITTED";
        } else {
          result = "ORDER_ERROR";
        }
      } catch (e) {
        derr("checkout error", e);
        try {
          orderContextRef.current.setCardStatus("failed");
        } catch {}
        result = "ORDER_ERROR";
      }
    }

    // ---------------- startItemFlow ----------------
    else if (fc.name === "startItemFlow") {
      const itemName = String(fc.args?.itemName || "").trim();
      dlog("startItemFlow request:", { itemName });

      const itemInfo = resolveItemInfo(ctx, itemName, dlog);

      if (!itemInfo?.item) {
        result = `ITEM_NOT_FOUND:${itemName}`;
      } else {
        const { item, category } = itemInfo;
        if (item.id) {
          triggerAnimation(item.id);
          await new Promise((resolve) =>
            setTimeout(resolve, ANIMATION_DELAY_MS)
          );
        }

        if (category && category.id !== ctx.selectedCategory?.id) {
          try {
            ctx.setSelectedCategory(category);
            dlog("Auto-switched to category:", category.name);
          } catch (e) {
            derr("Error switching to item category", e);
          }
        }

        try {
          ctx.startItemFlow(item);

          const variants = Array.isArray(item.variantlist)
            ? item.variantlist
            : [];
          const hasVariantChoice = variants.length > 1;

          if (hasVariantChoice) {
            const validOptionNames = variants
              .map((v: any) => v.name)
              .join(", ");
            result = `WIZARD_STARTED:SELECT_VARIANT:${item.name} (Options: ${validOptionNames})`;
          } else if (variants.length === 1) {
            const variant = variants[0];
            const modGroups =
              (variant as any).modifierlist ||
              (variant as any).modifierList ||
              [];
            const hasModifiers = modGroups.some(
              (g: any) => g.list && g.list.length > 0
            );

            if (hasModifiers) {
              result = `WIZARD_STARTED:SELECT_MODIFIERS:${item.name}`;
            } else {
              result = `ADDED:${item.name}. SCREEN_READY. MUST_ASK: "Anything else?"`;
            }
          } else {
            result = `WIZARD_STARTED:${item.name}`;
          }
        } catch (e) {
          derr("startItemFlow error", e);
          result = `ERROR_STARTING_WIZARD:${itemName}`;
        }
      }
    }

    // ---------------- selectVariant ----------------
    else if (fc.name === "selectVariant") {
      const variantName = String(fc.args?.variantName || "").trim();
      dlog("selectVariant request:", { variantName });

      if (!ctx.activeItem) {
        result = "ERROR:No active item. Use startItemFlow first.";
      } else {
        const item = ctx.activeItem;
        if (item.id) triggerAnimation(item.id);
        const variants = Array.isArray(item.variantlist)
          ? item.variantlist
          : [];

        // Find matching variant
        const targetVariant = variants.find(
          (v: any) =>
            normalize(v.name).includes(normalize(variantName)) ||
            normalize(variantName).includes(normalize(v.name))
        );

        if (!targetVariant) {
          const availableVariants = variants.map((v: any) => v.name).join(", ");
          result = `VARIANT_NOT_FOUND:${variantName}. Available: ${availableVariants}`;
        } else {
          try {
            if (targetVariant.id) {
              triggerAnimation(targetVariant.id);
              await new Promise((resolve) =>
                setTimeout(resolve, ANIMATION_DELAY_MS)
              );
            }
            ctx.selectVariant(targetVariant);

            const modGroups =
              (targetVariant as any).modifierlist ||
              (targetVariant as any).modifierList ||
              [];
            const hasModifiers = modGroups.some(
              (g: any) => g.list && g.list.length > 0
            );

            if (hasModifiers) {
              result = `VARIANT_SELECTED:${targetVariant.name}. SELECT_MODIFIERS:${item.name}`;
            } else {
              result = `ADDED:${item.name} (${targetVariant.name}). SCREEN_READY. MUST_ASK: "Anything else?"`;
            }
          } catch (e) {
            derr("selectVariant error", e);
            result = `ERROR_SELECTING_VARIANT:${variantName}`;
          }
        }
      }
    }

    // ---------------- toggleModifier ----------------
    else if (fc.name === "toggleModifier") {
      const modifierName = String(fc.args?.modifierName || "").trim();
      const requestedQty =
        fc.args?.quantity !== undefined ? Number(fc.args.quantity) : null;
      dlog("toggleModifier request:", { modifierName, requestedQty });

      if (!ctx.activeItem || !ctx.activeVariant) {
        result = "ERROR:No active customization. Use startItemFlow first.";
      } else {
        const variant = ctx.activeVariant;
        if (variant.id) {
          setTimeout(() => {
            triggerAnimation(String(variant.id));
          }, 150);
        }
        const modGroups =
          (variant as any).modifierlist || (variant as any).modifierList || [];

        // SMART AMBIGUITY DETECTION: Find all matching modifiers, not just the first one
        let allMatches: Array<{ mod: any; group: any }> = [];

        for (const group of modGroups) {
          const matches =
            group.list?.filter(
              (m: any) =>
                normalize(m.name).includes(normalize(modifierName)) ||
                normalize(modifierName).includes(normalize(m.name))
            ) || [];

          for (const mod of matches) {
            allMatches.push({ mod, group });
          }
        }

        // Check for ambiguous modifiers (e.g., "Pepsi" matches "Pepsi Can", "Diet Pepsi Can", "Pepsi Max Can")
        if (allMatches.length > 1) {
          // Check if user input is specific enough
          const normalizedInput = normalize(modifierName);

          // If any match is EXACT, use it
          const exactMatch = allMatches.find(
            ({ mod }) => normalize(mod.name) === normalizedInput
          );

          if (exactMatch) {
            allMatches = [exactMatch];
          } else {
            // Multiple matches found - request clarification
            const options = allMatches.map(({ mod }) => mod.name).join(", ");
            dlog(
              `Ambiguous modifier detected: "${modifierName}" matches multiple: ${options}`
            );
            result = `MODIFIER_AMBIGUOUS:${modifierName}. Options: ${options}. ASK_USER: "Which one - ${options}?"`;
            return; // Exit early - don't select anything
          }
        }

        let foundMod = allMatches.length > 0 ? allMatches[0].mod : null;
        let foundGroup = allMatches.length > 0 ? allMatches[0].group : null;

        if (!foundMod || !foundGroup) {
          dlog(`Modifier "${modifierName}" not found. Adding as note.`);
          if (typeof ctx.setActiveNote === "function") {
            ctx.setActiveNote((prev: string) => {
              const parts = prev ? prev.split(", ") : [];
              if (
                !parts.some((p) =>
                  p.toLowerCase().includes(modifierName.toLowerCase())
                )
              ) {
                return prev ? prev + ", " + modifierName : modifierName;
              }
              return prev;
            });
          }
          result = `NOTE_ADDED:${modifierName}`;
        } else {
          try {
            if (foundMod.id) {
              triggerAnimation(foundMod.id);
              await new Promise((resolve) =>
                setTimeout(resolve, ANIMATION_DELAY_MS)
              );
            }
            const existingMod = ctx.activeModifiers?.find(
              (m: any) => m.id === foundMod.id
            );
            const wasSelected = !!existingMod;
            const currentQty = existingMod ? existingMod.modqty : 0;

            if (requestedQty === 0) {
              if (wasSelected) {
                if (foundGroup.is_multiple) {
                  if (typeof ctx.updateModifierQty === "function") {
                    ctx.updateModifierQty(foundMod.id, -currentQty);
                    result = `MODIFIER_REMOVED:${foundMod.name}`;
                  } else {
                    ctx.toggleModifier(foundMod, foundGroup);
                    result = `MODIFIER_UPDATED:${foundMod.name}`;
                  }
                } else {
                  ctx.toggleModifier(foundMod, foundGroup);
                  ctx.toggleModifier(foundMod, foundGroup);
                  result = `MODIFIER_REMOVED:${foundMod.name}`;
                }
              } else {
                result = `MODIFIER_ALREADY_REMOVED:${foundMod.name}`;
              }
            } else if (requestedQty !== null && requestedQty > 0) {
              if (!wasSelected) {
                ctx.toggleModifier(foundMod, foundGroup);
                if (requestedQty > 1) {
                  if (
                    foundGroup.is_multiple &&
                    typeof ctx.updateModifierQty === "function"
                  ) {
                    ctx.updateModifierQty(foundMod.id, requestedQty - 1);
                  }
                }
                result = `MODIFIER_ADDED:${foundMod.name}`;
              } else {
                const delta = requestedQty - currentQty;
                if (
                  delta !== 0 &&
                  typeof ctx.updateModifierQty === "function"
                ) {
                  ctx.updateModifierQty(foundMod.id, delta);
                  result = `MODIFIER_QTY_UPDATED:${foundMod.name} to ${requestedQty}`;
                } else {
                  result = `MODIFIER_ALREADY_HAS_QTY:${foundMod.name} (${currentQty})`;
                }
              }
            } else {
              ctx.toggleModifier(foundMod, foundGroup);

              if (wasSelected && !foundGroup.is_multiple) {
                result = `MODIFIER_REMOVED:${foundMod.name}`;
              } else {
                result = `MODIFIER_ADDED:${foundMod.name}`;
              }
            }
          } catch (e) {
            derr("toggleModifier error", e);
            result = `ERROR_TOGGLING:${modifierName}`;
          }
        }
      }
    }

    // ---------------- confirmSelection ----------------
    else if (fc.name === "confirmSelection") {
      dlog("confirmSelection request");
      if (ctx.activeItem && typeof ctx.confirmItem === "function") {
        try {
          if (ctx.activeItem.id) {
            triggerAnimation(ctx.activeItem.id);
            await new Promise((resolve) =>
              setTimeout(resolve, ANIMATION_DELAY_MS)
            );
          }
          ctx.confirmItem();
          result = `ITEM_CONFIRMED:${ctx.activeItem.name}. SHOWING_CATEGORIES. ASK_ANYTHING_ELSE`;
        } catch (e) {
          derr("confirmSelection error", e);
          result = "ERROR_CONFIRMING_ITEM";
        }
      } else {
        result = "NO_ACTIVE_ITEM_TO_CONFIRM";
      }
    }

    // ---------------- updateModifierQuantity ----------------
    else if (fc.name === "updateModifierQuantity") {
      const modifierName = String(fc.args?.modifierName || "").trim();
      const quantity = Number(fc.args?.quantity || 1);
      dlog("updateModifierQuantity request:", { modifierName, quantity });

      if (!ctx.activeItem || !ctx.activeVariant) {
        result = "ERROR:No active customization.";
      } else {
        const activeMod = ctx.activeModifiers?.find(
          (m: any) =>
            normalize(m.name).includes(normalize(modifierName)) ||
            normalize(modifierName).includes(normalize(m.name))
        );

        if (!activeMod) {
          result = `ERROR:${modifierName} not selected. Use toggleModifier first.`;
        } else {
          try {
            if (activeMod.id) {
              triggerAnimation(activeMod.id);
              await new Promise((resolve) =>
                setTimeout(resolve, ANIMATION_DELAY_MS)
              );
            }
            const delta = quantity - activeMod.modqty;

            if (delta !== 0) {
              ctx.updateModifierQty(activeMod.id, delta);
              result = `MODIFIER_QUANTITY_UPDATED:${activeMod.name} x${quantity}`;
            } else {
              result = `MODIFIER_QUANTITY_UNCHANGED:${activeMod.name} already x${quantity}`;
            }
          } catch (e) {
            derr("updateModifierQuantity error", e);
            result = `ERROR_UPDATING_QUANTITY:${modifierName}`;
          }
        }
      }
    }

    // ---------------- changeCategory ----------------
    else if (fc.name === "changeCategory") {
      const requested = String(fc.args?.categoryName || "").trim();
      const cat = findCategoryByNameLoose(ctx, requested);

      dlog("changeCategory request:", { requested, matched: cat?.name });

      if (cat) {
        try {
          if (cat.id) {
            triggerAnimation(cat.id);
            await new Promise((resolve) =>
              setTimeout(resolve, ANIMATION_DELAY_MS)
            );
          }
          if (typeof ctx.cancelFlow === "function") ctx.cancelFlow();
          ctx.setSelectedCategory(cat);
        } catch (e) {
          derr("changeCategory set error", e);
        }
        result = `CATEGORY_SHOWN:${cat.name}`;
      } else {
        const availableCats =
          ctx.menu?.categorylist?.map((c: any) => c.name).join(", ") || "";
        result = `CATEGORY_NOT_FOUND:${requested}.AVAILABLE:${availableCats}`;
      }
    } else if (fc.name === "getMenuDetails") {
      const rawName = String(fc.args?.itemName || "").trim();
      const itemInfo = resolveItemInfo(ctx, rawName, dlog);

      if (!itemInfo?.item) {
        result = `ITEM_NOT_FOUND:${rawName}`;
      } else {
        const { item } = itemInfo;
        if (item.id) {
          setTimeout(() => {
            triggerAnimation(String(item.id));
          }, 150);
        }
        const CURRENCY = "£";

        let price = item.variantlist?.[0]?.price;
        if (!price || Number(price) === 0) {
          price = item.price;
        }

        const finalPrice = price ? Number(price).toFixed(2) : "Varies";
        const desc = item.description || "";
        result = `DETAILS: Item: ${item.name}. Price: ${CURRENCY}${finalPrice}. Description: ${desc}`;

        if (itemInfo.category) {
          try {
            // ✅ Don't cancel flow for getMenuDetails - just show category
            ctx.setSelectedCategory(itemInfo.category);
          } catch (e) {}
        }
      }
    }

    // ---------------- getModifierDetails ----------------
    else if (fc.name === "getModifierDetails") {
      const itemName = String(fc.args?.itemName || "").trim();
      const modifierName = String(fc.args?.modifierName || "").trim();

      dlog("getModifierDetails request:", { itemName, modifierName });

      const itemInfo = resolveItemInfo(ctx, itemName, dlog);

      if (!itemInfo?.item) {
        result = `ITEM_NOT_FOUND:${itemName}`;
      } else {
        const { item } = itemInfo;
        if (item.id) {
          setTimeout(() => {
            triggerAnimation(String(item.id));
          }, 150);
        }
        const CURRENCY = "£";
        let foundModifier: any = null;
        let foundInVariant: any = null;

        for (const variant of item.variantlist || []) {
          for (const group of variant.modifierlist || []) {
            const mod = group.list?.find(
              (m: any) =>
                normalize(m.name).includes(normalize(modifierName)) ||
                normalize(modifierName).includes(normalize(m.name))
            );

            if (mod) {
              foundModifier = mod;
              if (mod.id) triggerAnimation(mod.id);
              foundInVariant = variant;
              break;
            }
          }
          if (foundModifier) break;
        }

        if (!foundModifier) {
          result = `MODIFIER_NOT_FOUND:${modifierName} in ${itemName}`;
        } else {
          const price = Number(foundModifier.price || 0);

          if (price === 0 || price === 0.0) {
            result = `MODIFIER_DETAILS: ${foundModifier.name} is FREE_WITH_MEAL in ${item.name}`;
          } else {
            result = `MODIFIER_DETAILS: ${
              foundModifier.name
            } costs ${CURRENCY}${price.toFixed(2)} in ${item.name}`;
          }

          dlog("Modifier found:", {
            modifier: foundModifier.name,
            price: foundModifier.price,
            variant: foundInVariant?.name,
          });
        }
      }
    }

    // ---------------- removeFromCart ----------------
    else if (fc.name === "removeFromCart") {
      const itemName = String(fc.args?.itemName || "").trim();
      dlog("removeFromCart request:", { itemName });

      const cart = ctx.cart || [];
      const normalizedName = normalize(itemName);

      const cartItem = [...cart]
        .reverse()
        .find(
          (ci: any) =>
            normalize(ci.name).includes(normalizedName) ||
            normalizedName.includes(normalize(ci.name))
        );

      if (!cartItem) {
        result = `ITEM_NOT_IN_CART:${itemName}`;
      } else {
        try {
          if (typeof ctx.removeFromCart === "function") {
            if (cartItem.id) {
              triggerAnimation(cartItem.id);
              await new Promise((resolve) =>
                setTimeout(resolve, ANIMATION_DELAY_MS)
              );
            }
            ctx.removeFromCart(cartItem.cartId);
            result = `REMOVED:${cartItem.name}`;
          } else {
            result = "ERROR_REMOVING_ITEM";
          }
        } catch (e) {
          derr("removeFromCart error", e);
          result = "ERROR_REMOVING_ITEM";
        }
      }
    }

    // ---------------- updateCartItemQuantity ----------------
    else if (fc.name === "updateCartItemQuantity") {
      const itemName = String(fc.args?.itemName || "").trim();
      const newQty = Number(fc.args?.quantity || 1);

      dlog("updateCartItemQuantity request:", { itemName, newQty });

      const cart = ctx.cart || [];
      const normalizedName = normalize(itemName);

      const cartItem = cart.find(
        (ci: any) =>
          normalize(ci.name).includes(normalizedName) ||
          normalizedName.includes(normalize(ci.name))
      );

      if (!cartItem) {
        result = `ITEM_NOT_IN_CART:${itemName}`;
      } else {
        try {
          if (cartItem.id) {
            triggerAnimation(cartItem.id);
            await new Promise((resolve) =>
              setTimeout(resolve, ANIMATION_DELAY_MS)
            );
          }
          const currentQty = cartItem.qty;
          const delta = newQty - currentQty;

          if (delta === 0) {
            result = `QUANTITY_UNCHANGED:${cartItem.name} is already ${newQty}`;
          } else {
            if (typeof ctx.updateCartItemQty === "function") {
              ctx.updateCartItemQty(cartItem.cartId, delta);
              result = `QUANTITY_UPDATED:${cartItem.name} to ${newQty}`;
            } else {
              result = "ERROR_UPDATING_QUANTITY";
            }
          }
        } catch (e) {
          derr("updateCartItemQuantity error", e);
          result = "ERROR_UPDATING_QUANTITY";
        }
      }
    }

    // ---------------- showModifierShowcase ----------------
    else if (fc.name === "showModifierShowcase") {
      try {
        // Trigger the smooth scroll function exposed by ModifierSelector
        if (typeof (window as any).scrollModifiersForAI === "function") {
          (window as any).scrollModifiersForAI();
          result =
            "SCROLLING_MODIFIERS:Showcasing all available toppings (3 seconds)";
        } else {
          result = "ERROR:Modifier screen not active";
        }
      } catch (e) {
        derr("showModifierShowcase error", e);
        result = "ERROR:Failed to showcase modifiers";
      }
    }

    dlog("Tool result ->", result);

    if (activeSessionPromiseRef.current && isSessionActive.current) {
      activeSessionPromiseRef.current
        .then((session) => {
          if (!isSessionActive.current) return;
          try {
            session.sendToolResponse({
              functionResponses: {
                id: fc.id,
                name: fc.name,
                response: { result },
              },
            });
          } catch (error) {
            dwarn("Failed to send tool response", error);
          }
        })
        .catch((err) => {
          dwarn("Session error during tool response", err);
        });
    }
  };

  return { handleToolCall };
};
