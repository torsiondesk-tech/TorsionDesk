/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./node_modules/.pnpm/@serwist+next@9.5.11_next@1_a460870ce1d5e183c1ea43579abdf259/node_modules/@serwist/next/dist/sw-entry-worker.mjs":
/*!*********************************************************************************************************************************************!*\
  !*** ./node_modules/.pnpm/@serwist+next@9.5.11_next@1_a460870ce1d5e183c1ea43579abdf259/node_modules/@serwist/next/dist/sw-entry-worker.mjs ***!
  \*********************************************************************************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval(__webpack_require__.ts("__webpack_require__.r(__webpack_exports__);\n//#region src/sw-entry-worker.ts\nself.onmessage = async (ev) => {\n\tswitch (ev.data.type) {\n\t\tcase \"__START_URL_CACHE__\": {\n\t\t\tconst url = ev.data.url;\n\t\t\tconst response = await fetch(url);\n\t\t\tif (!response.redirected) return (await caches.open(\"start-url\")).put(url, response);\n\t\t\treturn Promise.resolve();\n\t\t}\n\t\tcase \"__FRONTEND_NAV_CACHE__\": {\n\t\t\tconst url = ev.data.url;\n\t\t\tconst pagesCache = await caches.open(\"pages\");\n\t\t\tif (!!await pagesCache.match(url, { ignoreSearch: true })) return;\n\t\t\tconst page = await fetch(url);\n\t\t\tif (!page.ok) return;\n\t\t\tpagesCache.put(url, page.clone());\n\t\t\treturn Promise.resolve();\n\t\t}\n\t\tdefault: return Promise.resolve();\n\t}\n};\n//#endregion\n\n\n//# sourceMappingURL=sw-entry-worker.mjs.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiLi9ub2RlX21vZHVsZXMvLnBucG0vQHNlcndpc3QrbmV4dEA5LjUuMTFfbmV4dEAxX2E0NjA4NzBjZTFkNWUxODNjMWVhNDM1NzlhYmRmMjU5L25vZGVfbW9kdWxlcy9Ac2Vyd2lzdC9uZXh0L2Rpc3Qvc3ctZW50cnktd29ya2VyLm1qcyIsIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsdUNBQXVDLG9CQUFvQjtBQUMzRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDVTs7QUFFViIsInNvdXJjZXMiOlsiQzpcXFVzZXJzXFxtYXJjb1xcRGVza3RvcFxcSE9NRSBTRVJWSUNFIENSTVxcbm9kZV9tb2R1bGVzXFwucG5wbVxcQHNlcndpc3QrbmV4dEA5LjUuMTFfbmV4dEAxX2E0NjA4NzBjZTFkNWUxODNjMWVhNDM1NzlhYmRmMjU5XFxub2RlX21vZHVsZXNcXEBzZXJ3aXN0XFxuZXh0XFxkaXN0XFxzdy1lbnRyeS13b3JrZXIubWpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vI3JlZ2lvbiBzcmMvc3ctZW50cnktd29ya2VyLnRzXG5zZWxmLm9ubWVzc2FnZSA9IGFzeW5jIChldikgPT4ge1xuXHRzd2l0Y2ggKGV2LmRhdGEudHlwZSkge1xuXHRcdGNhc2UgXCJfX1NUQVJUX1VSTF9DQUNIRV9fXCI6IHtcblx0XHRcdGNvbnN0IHVybCA9IGV2LmRhdGEudXJsO1xuXHRcdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaCh1cmwpO1xuXHRcdFx0aWYgKCFyZXNwb25zZS5yZWRpcmVjdGVkKSByZXR1cm4gKGF3YWl0IGNhY2hlcy5vcGVuKFwic3RhcnQtdXJsXCIpKS5wdXQodXJsLCByZXNwb25zZSk7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdFx0fVxuXHRcdGNhc2UgXCJfX0ZST05URU5EX05BVl9DQUNIRV9fXCI6IHtcblx0XHRcdGNvbnN0IHVybCA9IGV2LmRhdGEudXJsO1xuXHRcdFx0Y29uc3QgcGFnZXNDYWNoZSA9IGF3YWl0IGNhY2hlcy5vcGVuKFwicGFnZXNcIik7XG5cdFx0XHRpZiAoISFhd2FpdCBwYWdlc0NhY2hlLm1hdGNoKHVybCwgeyBpZ25vcmVTZWFyY2g6IHRydWUgfSkpIHJldHVybjtcblx0XHRcdGNvbnN0IHBhZ2UgPSBhd2FpdCBmZXRjaCh1cmwpO1xuXHRcdFx0aWYgKCFwYWdlLm9rKSByZXR1cm47XG5cdFx0XHRwYWdlc0NhY2hlLnB1dCh1cmwsIHBhZ2UuY2xvbmUoKSk7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdFx0fVxuXHRcdGRlZmF1bHQ6IHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcblx0fVxufTtcbi8vI2VuZHJlZ2lvblxuZXhwb3J0IHt9O1xuXG4vLyMgc291cmNlTWFwcGluZ1VSTD1zdy1lbnRyeS13b3JrZXIubWpzLm1hcCJdLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOlswXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///./node_modules/.pnpm/@serwist+next@9.5.11_next@1_a460870ce1d5e183c1ea43579abdf259/node_modules/@serwist/next/dist/sw-entry-worker.mjs\n"));

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The require scope
/******/ 	var __webpack_require__ = {};
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/trusted types policy */
/******/ 	(() => {
/******/ 		var policy;
/******/ 		__webpack_require__.tt = () => {
/******/ 			// Create Trusted Type policy if Trusted Types are available and the policy doesn't exist yet.
/******/ 			if (policy === undefined) {
/******/ 				policy = {
/******/ 					createScript: (script) => (script)
/******/ 				};
/******/ 				if (typeof trustedTypes !== "undefined" && trustedTypes.createPolicy) {
/******/ 					policy = trustedTypes.createPolicy("nextjs#bundler", policy);
/******/ 				}
/******/ 			}
/******/ 			return policy;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/trusted types script */
/******/ 	(() => {
/******/ 		__webpack_require__.ts = (script) => (__webpack_require__.tt().createScript(script));
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/react refresh */
/******/ 	(() => {
/******/ 		if (__webpack_require__.i) {
/******/ 		__webpack_require__.i.push((options) => {
/******/ 			const originalFactory = options.factory;
/******/ 			options.factory = (moduleObject, moduleExports, webpackRequire) => {
/******/ 				const hasRefresh = typeof self !== "undefined" && !!self.$RefreshInterceptModuleExecution$;
/******/ 				const cleanup = hasRefresh ? self.$RefreshInterceptModuleExecution$(moduleObject.id) : () => {};
/******/ 				try {
/******/ 					originalFactory.call(this, moduleObject, moduleExports, webpackRequire);
/******/ 				} finally {
/******/ 					cleanup();
/******/ 				}
/******/ 			}
/******/ 		})
/******/ 		}
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	
/******/ 	// noop fns to prevent runtime errors during initialization
/******/ 	if (typeof self !== "undefined") {
/******/ 		self.$RefreshReg$ = function () {};
/******/ 		self.$RefreshSig$ = function () {
/******/ 			return function (type) {
/******/ 				return type;
/******/ 			};
/******/ 		};
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval-source-map devtool is used.
/******/ 	var __webpack_exports__ = {};
/******/ 	__webpack_modules__["./node_modules/.pnpm/@serwist+next@9.5.11_next@1_a460870ce1d5e183c1ea43579abdf259/node_modules/@serwist/next/dist/sw-entry-worker.mjs"](0, __webpack_exports__, __webpack_require__);
/******/ 	
/******/ })()
;