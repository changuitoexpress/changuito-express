---
name: AI ordering safety
description: Why conversational order proposals require deterministic validation, confirmation, and low-latency model checks.
---

Treat generated orders as proposals, never as authority to change the cart or place an order.

**Why:** the user reported that the previous keyword bot added the wrong products and wants a conversational assistant that orients customers with real prices.

**How to apply:** resolve product names, prices and availability from the actual catalog; require an explicit customer confirmation; recheck stock and prices before passing a proposal to the existing cart. Do not let generated prose claim a purchase has already happened.

Choose a low-latency model using a live generation check, not a documentation headline or model listing alone.

**Why:** a valid key listed models successfully, but a newer reasoning model timed out and a listed legacy model returned 404 on generation. The available Flash Lite alias completed the small order fixture in about one second.

**How to apply:** use safe metadata diagnostics and a small catalog fixture when changing providers/models. Never log credentials, and do not repeatedly switch to newer/heavier models while assuming they will be faster.

El usuario quiere platicar con el asistente y oír sus respuestas sin pulsar Enviar después de cada turno; no considera suficiente un micrófono que solo rellene el campo de texto.

**Why:** distinguió explícitamente la conversación hablada del dictado manual.

**How to apply:** mantener una opción de conversación por turnos, además de texto y dictado; la voz conserva los mismos límites de confirmación y precios que el chat escrito.

Keep spoken replies short and conversational; do not repeat the full visible order summary. Let customers interrupt speech, and prefer a masculine Spanish system voice only when the device exposes a clearly identifiable one.

**Why:** the user observed that full spoken recaps waste customers' time and asked for natural interruption and a possible male voice, while leaving the voice choice to product judgment.

**How to apply:** speak one or two brief sentences, listen for a user interjection during playback with echo filtering, and fall back to an available Spanish voice rather than assuming a device supports a masculine voice.

Una propuesta puede incluir productos de varios negocios que el cliente haya identificado; el resumen visible debe agruparlos por negocio y nunca mostrar identificadores internos.

**Why:** el usuario quiere completar una compra entre negocios desde un mismo carrito y reportó que el bot mostraba IDs en sus respuestas.

**How to apply:** mantener los IDs solo para resolver productos del catálogo internamente; presentar y hablar con nombres de producto y negocio, mostrar subtotales agrupados y conservar el límite actual de cuatro negocios por carrito.
