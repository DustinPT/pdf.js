/* Copyright 2012 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { FindState } from './pdf_find_controller';

const PUNCTUATIONS = '。？！，；.?!.;';
const MATCH_EXTENT = 30;

/**
 * @typedef {Object} PDFFindResultViewerOptions
 * @property {HTMLDivElement} container - The viewer element.
 * @property {EventBus} eventBus - The application event bus.
 */

/**
 * @typedef {Object} PDFOutlineViewerRenderParameters
 * @property {Array|null} outline - An array of outline objects.
 */

class PDFFindResultViewer {
  /**
   * @param {PDFFindResultViewerOptions} options
   */
  constructor({ container, eventBus, }) {
    this.container = container;
    this.eventBus = eventBus;
    this.pageMatches = [];

    this.eventBus.on('updatefindcontrolstate',
      this._onUpdateFindControlState.bind(this));
    this.eventBus.on('updatefindmatchescount',
      this._onUpdateFindMatchesCount.bind(this));
  }

  _onUpdateFindControlState({ matchesCount, previous, source, state, }) {
    if (state === FindState.PENDING && source._dirtyMatch) {
      this.pageMatches = [];
      this.container.innerText = '';
    }
  }

  _onUpdateFindMatchesCount({ matchesCount, source, }) {
    const query = source.state.query;
    const queryLength = query.length;
    for (let pageIdx = 0, totalPages = source._pageContents.length;
         pageIdx < totalPages; pageIdx++) {
      // 跳过已经处理过的页面
      if (this.pageMatches[pageIdx]) {
        continue;
      }
      const pageContent = source._pageContents[pageIdx];
      const matches = source._pageMatches[pageIdx];
      // 跳过还没有结果的页面
      if (!matches) {
        continue;
      }
      const pageDiv = document.createElement('div');
      pageDiv.id = 'find-result-page-' + pageIdx;
      for (let matchIdx = 0, totalMatches = matches.length;
           matchIdx < totalMatches; matchIdx++) {
        const matchElement = document.createElement('p');
        const match = matches[matchIdx];
        const prevMatch = matchIdx > 0 ? matches[matchIdx - 1] : null;
        const nextMatch = matchIdx < matches.len - 1 ?
          matches[matchIdx + 1] : null;
        const prevMatchEnd = prevMatch ? (prevMatch + queryLength) : 0;
        const nextMatchStart = nextMatch ? nextMatch : pageContent.length;
        matchElement.innerHTML = this._escapeHtml(pageContent.substring(
          this._findStart(pageContent, match, prevMatchEnd), match)) + '<em>' +
          this._escapeHtml(query) + '</em>' + this._escapeHtml(
            pageContent.substring(match + queryLength, this._findEnd(
              pageContent, match + queryLength, nextMatchStart)));
        matchElement.onclick = () => {
          this._goToMatch(source, pageIdx, matchIdx);
        };
        pageDiv.appendChild(matchElement);
      }
      const prevPageMatch = this._findPrevPageMatch(pageIdx);
      if (prevPageMatch === null) {
        this.container.appendChild(pageDiv);
      } else {
        this._insertAfter(pageDiv,
          document.getElementById('find-result-page-' + prevPageMatch));
      }
      this.pageMatches[pageIdx] = true;
    }
  }

  _escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  _findStart(pageContent, matchStart, prevMatchEnd) {
    let result = false;
    for (let idx = matchStart - 1; idx >= prevMatchEnd; idx--) {
      if (PUNCTUATIONS.includes(pageContent.substring(idx, idx + 1))) {
        const len = matchStart - (idx + 1);
        if (len > MATCH_EXTENT) {
          break;
        } else if (len === MATCH_EXTENT) {
          result = idx + 1;
          break;
        } else {
          result = idx + 1;
        }
      }
    }
    return result === false ? Math.max(prevMatchEnd, matchStart - MATCH_EXTENT)
      : result;
  }

  _findEnd(pageContent, matchEnd, nextMatchStart) {
    let result = false;
    for (let idx = matchEnd; idx < nextMatchStart; idx++) {
      if (PUNCTUATIONS.includes(pageContent.substring(idx, idx + 1))) {
        const len = idx + 1 - matchEnd;
        if (len > MATCH_EXTENT) {
          break;
        } else if (len === MATCH_EXTENT) {
          result = idx + 1;
          break;
        } else {
          result = idx + 1;
        }
      }
    }
    return result === false ? Math.min(nextMatchStart, matchEnd + MATCH_EXTENT)
      : result;
  }

  _goToMatch(findController, pageIdx, matchIdx) {
    findController._offset.pageIdx = pageIdx;
    findController._offset.matchIdx = matchIdx;
    findController._offset.wrapped = false;
    findController._updateMatch(true);
  }

  _findPrevPageMatch(pageIdx) {
    for (let idx = pageIdx - 1; idx >= 0; idx--) {
      if (this.pageMatches[idx]) {
        return idx;
      }
    }
    return null;
  }

  _insertAfter(newNode, referenceNode) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
  }

  reset() {
    this.outline = null;
    this.lastToggleIsShow = true;

    // Remove the outline from the DOM.
    this.container.textContent = '';

    // Ensure that the left (right in RTL locales) margin is always reset,
    // to prevent incorrect outline alignment if a new document is opened.
    this.container.classList.remove('outlineWithDeepNesting');
  }
}

export {
  PDFFindResultViewer,
};
