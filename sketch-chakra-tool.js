// console.log(data)
let page = null
const cTool = new ChakraTool(data)
function rebind() {
    $('.layer').each(function() { 
        $(this).click(function() { 
            const pageId = getPageId()
            console.clear()
            const compClass = /layer-(.*)(\s+)+/.exec($(this).attr('class'))
            const compId = compClass[1]
            // console.log('%c ------', 'color: red')
            if (pageId && compId) {
                cTool.handleLayerClick(pageId, compId)
            }
        }) 
    })
}

function ChakraTool() {
    this.data = data;
    this.page = null;
    this.pageId = null;
    this.currentLayer = null;
    this.currentLayerObjectID = null;
    this.handleLayerClick = (pageId, compId) => {
        this.pageId = pageId;
        this.page = this.data.artboards.find(it => it.objectID == pageId)
        this.currentLayer = this.page.layers.find(it => it.objectID == compId)
        this.currentLayerObjectID = compId;
        if (!this.currentLayer || !this.page) {
            return;
        }
        console.log(this.page, this.currentLayer, this.currentLayerObjectID)
        // console.log(this.page)
        this.generateLineWrap()

        const treeRes = this.generateTree()
        console.log(treeRes)
        const outer = this.generateItemCode(this.currentLayer, this.getPadding(this.currentLayerObjectID, treeRes.mappedTree))
        // console.log(`outer=${outer}`)
        let wrapContent = '';
        if (treeRes.tree.filter(it => it.pid).length > 0) {
            wrapContent = treeRes.tree.sort(this.sortByXY).map(item => this.generateTreeCode(item, treeRes.mappedTree)).join('\n')
        }
        // console.log(wrapContent)
        const output = outer.replace("__INNER__", wrapContent || '')
        // // console.log(`code=`)
        // // const { output } =  generateCode(page, layer, usedIds, false, compId)
        console.log(`%c${output}`, 'color: #0f0')
        output && copyContent(output)
    }

    // 产生平级树
    this.generateFlatTree = (layer, tree) => {
        // const compRect = layer.rect
        // 找到内部的组件
        // ids.push(layer.objectID)
        const findWraps = this.getInnerElements(layer)
        // console.log('ids', ids)
        findWraps.forEach(it => {
            tree.push({ id: it.objectID, pid: layer.objectID, ele: it.name}) 
            this.generateFlatTree(it, tree)
            // ids.push(it.objectID)
        })
    }

    // 获取指定Layer 下的内部元素.
    this.getInnerElements = (layer) =>{
        // if (ids && ids.includes(layer.objectID)) {
        //     return []
        // }
        const compRect = layer.rect
        // console.log(layer.name, layer.objectID)
        // 找到内部的组件
        // let extendWraps = this.page.layers.filter(it => layer.objectIDs && layer.objectIDs.includes(it.objectID))
        // let extendWrapIds = extendWraps.map(it => it.objectID)
        // console.log(extendWrapIds)
        let extendWrapIds = this.page.layers.filter(it => it.pid == layer.objectID).map(it => it.objectID)
        let findWraps = this.page.layers.filter(it => (extendWrapIds || []).includes(it.objectID) || ((it.rect.x >= compRect.x) && (it.rect.y >= compRect.y) && (it.rect.x + it.rect.width) <= (compRect.x + compRect.width) && (it.rect.y + it.rect.height) < (compRect.y + compRect.height)))
        .filter(it => it.objectID != layer.objectID).sort((a, b) => a.rect.x - b.rect.x)
        // console.log(layer.name)
        // if (layer.name == '补充分组') {
        // }
        // if (findWraps.length > 0 || extendWraps.length > 0) {
        //     console.log('容器=' + layer.name)
        //     console.log('内部=' + findWraps.map(it => it.name).join(', ') + ',' + extendWraps.map(it => it.name).join(', '))
        // }
        return findWraps; //[...findWraps, ...extendWraps]
    }

    // 针对水平方向的平级元素, 为Sketch补充Layer, 为了生成代码有层级结构
    this.generateLineWrap = () => {
        // 找到内部组件纵坐标 + 高度的一半 能在中间上下5个像素的 去分到一组
        const innerElements = this.getInnerElements(this.currentLayer).filter(it => it.name != '补充分组')
        let grouped = innerElements.reduce((acc, cur) => {
            let key = cur.rect.y + cur.rect.height / 2

            let foundMatchRange = Object.entries(acc || {}).find(it => {
                console.log(it, key)
                return it[0] > key - 5 && it[0] < key + 5 //&& it[1].rect //&& Math.abs(it[1].rect.height - cur.rect.height) < 20
            })
            if (foundMatchRange) {
                key = foundMatchRange[0]
            }
            // console.log('foundMatchRange', foundMatchRange)
            if (acc[key]) 
                acc[key].push({ id: cur.objectID, name: cur.name, rect: cur.rect }) 
            else
                acc[key] = [{ id: cur.objectID, name: cur.name, rect: cur.rect}]
            return acc;
        }, {})
        console.log(grouped)
        
        let newLayers = Object.values(grouped).filter(it => it.length > 1 && it.length < innerElements.length).map(it => {
            let ids = it.map(it => it.id)
            return {
                type: 'shape',
                objectID: ids.join('|'),
                name: '补充分组',
                objectIDs: ids,
                pid: this.currentLayerObjectID,
                rect: this.getMaxCord(ids, this.currentLayer),
                css: [
                    'display: flex'
                ]
            }
        })
        console.log(newLayers)
        newLayers.forEach(it => {
            if (this.page.layers.filter(l => l.objectID == it.objectID) < 1) {
                this.page.layers.push(it)
            }
        })
    }

    // 获得包含指定一些元素的最小外框的坐标
    this.getMaxCord = (ids, layer) => {
        let x = 99999, y = 99999, w = 0, h = 0
    
        ids.map(it => this.page.layers.find(l => l.objectID == it)).forEach(item => {
            x = item.rect.x < x ? item.rect.x : x
            y = item.rect.y < y ? item.rect.y : y;
            w = (item.rect.width + item.rect.x) > w ? (item.rect.width + item.rect.x) : w;
            // console.log(item.rect.x, item.rect.width, (item.rect.width+ item.rect.x), w)
            h = item.rect.height > h ? item.rect.height : h;
        })
    
        // if (x + w > layer.rect.x + layer.rect.width) {
        //     w  = layer.rect.width - x;
        // }
        return { x: x-1 , y: y -1, width: w+2, height: h +2}
    }

    this.generateTree = () => {
        const flatTree = []
        this.generateFlatTree(this.currentLayer, flatTree, [])
        console.log(`flatTree`, flatTree)
        const newTree =  []
        flatTree.forEach(it => {
            if (!newTree[it.id])
                newTree[it.id] = it.pid
        })
        // console.log(newTree)
        const mappedTree = []
        for (k in newTree) {
            mappedTree.push({ id: k, pid: newTree[k] })
        }
        // console.log(`mappedTree=`, mappedTree)
        let treeMapList = mappedTree.reduce((prev, current) => {
            prev[current['id']] = current;
            return prev
        }, {})

        let result = mappedTree.reduce((arr, current) => {
            let pid = current.pid;
            let parent = treeMapList[pid];
            if (parent) {
                parent.children ? parent.children.push(current) :             
                parent.children = [current];
            } else if (pid === this.currentLayerObjectID) {
                arr.push(current);
            }
            return arr;
        }, []);

        if (result.length ==0) {
            result.push({ id: this.currentLayerObjectID })
        }
        // 过滤掉空的container
        // result = result.filter(it => it.id.indexOf('|') != -1 && (it.children || []).length > 0 )
        return { tree: result.slice(0), mappedTree }
    }

    // 生成单个元素的代码
    this.generateItemCode = (layer, extraCss = []) => {
        const type = layer.type
        const css = [...layer.css.filter((it, key) => it.split(':')[0] != 'font-family').map(it => {
            let kv = it.split(':')
            return { key: kv[0], value: kv[1].trim().replace(';', '') }
        }), ...extraCss]

        if (layer.name == '补充分组') {
            // css.push({ key: 'd', value: 'flex'})
        } else {
            if (layer.css.length == 0 || layer.rect.height < 10 || layer.rect.width < 50) {
                css.push({ key: 'w', value: layer.rect.width.toFixed(0) + 'px'})
                css.push({ key: 'h', value: layer.rect.height.toFixed(0) + 'px'})
        
                if (layer.type == 'shape') {
                    css.filter(it => it.key == 'bg' || it.key == 'background').length < 1 ? css.push({ key: 'bg', value: 'gray.200' }): null
                }
            }
        }
        // css.push({ key: 'd', value: 'flex'})
        // const compRect = layer.rect

        let attrs = {}
        css.forEach(it => {
            attrs[it.key] = it.value
        })
        
        let output = ''
        let attrsStr = Object.entries(attrs).map(it => `${it[0]}="${it[1]}"`).join(' ')
        // console.log(`type=${type}`)
        switch (type) {
            case 'text':
                output = `<c-box ${attrsStr}>${ type == 'text' ? layer.content : ''}</c-box>`
                // console.log(`%c ${output}`, 'color:#0f0;')
                break;
            case 'slice':
                let elms = this.getInnerElements(layer)
                if (elms.length > 0) {
                    output = `<c-box :bg-image="require('@/assets/${layer.name}.png')" bg-size="100% 100%" ${attrsStr}>\n__INNER__\n</c-box>`
                } else {
                    output = `<c-image :src="require('@/assets/${layer.name}.png')" w="${layer.rect.width.toFixed(0)}px" h="${layer.rect.height.toFixed(0)}px" />`
                }
                // console.log(`%c ${output}`, 'color: #0f0')
                break;
            case 'shape':
                output = `<c-box ${attrsStr}>\n__INNER__\n</c-box>`
                // console.log(`%c ${output}`, 'color:#0f0;')
                break;
        }
        return output;
    }

    // 获得内部的 padding 
    this.getPadding = (containerId, mappedTree) => {
        let minL = 999999, minT = 999999, minR = 999999, minB = 999999
        let layer = this.page.layers.find(l => l.objectID == containerId)
        if (layer.name == '补充分组') {
            return []
        }
        let innerChildren = this.page.layers.filter(it => mappedTree.filter(it => it.pid == containerId).map(node => node.id).includes(it.objectID))

        const compRect = layer.rect
        innerChildren.map(it => {
            const findWrap = it
            const findWrapRect = findWrap.rect
            const pl = findWrapRect.x - compRect.x 
            const pt = findWrapRect.y - compRect.y
            const pr = compRect.x + compRect.width - findWrapRect.x - findWrapRect.width
            const pb = compRect.y + compRect.height - findWrapRect.y - findWrapRect.height
            
            minL = pl < minL ? pl : minL
            minR = pr < minR ? pr : minR
            minT = pt < minT ? pt : minT
            minB = pb < minB ? pb : minB
        })

        if (Math.abs(minR - minL) > 30) {
            minR = Math.min(minR, minL)
            minL = minR
        }
        let css = []
        // console.log(`minL=${minL}, minT=${minT}, minR = ${minR}, minB=${minB}`)
        minL != 999999 && css.push({ key: 'pl', value: minL.toFixed(0) + 'px'})
        minT != 999999 && css.push({ key: 'pt', value: minT.toFixed(0)+ 'px'})
        minR != 999999 && css.push({ key: 'pr', value: minR.toFixed(0) + 'px'})
        minB != 999999 && css.push({ key: 'pb', value: minB.toFixed(0) + 'px'})

        if (layer.css.length == 0 && layer.name != '补充分组') {
            css.push({ key: 'w', value: layer.rect.width.toFixed(0) + 'px'})
            css.push({ key: 'h', value: layer.rect.height.toFixed(0) + 'px'})
        }
        return css
    }


    this.sortByXY = (a,b) => {
        let a1 = this.page.layers.find(l => l.objectID == a.id)
        let b1 = this.page.layers.find(l => l.objectID == b.id)
        let x1 = a1.rect.x - b1.rect.x

        if (x1 == 0) {
            return this.sortFunY(a, b)
        }
        return x1
    }
    // function sortFunX(a,b) {
    //     let a1 = page.layers.find(l => l.objectID == a.id)
    //     let b1 = page.layers.find(l => l.objectID == b.id)
    //     return a1.rect.x - b1.rect.x
    // }
    this.sortFunY = (a,b) => {
        let a1 = this.page.layers.find(l => l.objectID == a.id)
        let b1 = this.page.layers.find(l => l.objectID == b.id)
        return a1.rect.y - b1.rect.y
    }

    this.generateTreeCode = (treeItem, mappedTree) => {
        const parentNodeId = treeItem.pid
        const currentNodeId = treeItem.id;
        const layer = this.page.layers.find(l => l.objectID == currentNodeId)

        const wrapperOutput = (treeItem.children || []).sort(this.sortByXY).map(childNode => {
            return this.generateTreeCode(childNode, mappedTree)
        })
        
        const output = this.generateItemCode(layer, this.getPadding(currentNodeId, mappedTree))
        return output.replace('__INNER__', wrapperOutput.join('\n'))
    }
}

function getPageId() {
    const currentPage = $('.artboard-list').find('.active')
    if (currentPage) {
        const pageId = $(currentPage[0]).attr('data-id')
        return pageId;
    }
    return false
}

function findNearestLeft(current, elements) {
    return Math.min(elements.filter(it => it.rect.x + it.rect.width < current.rect.x).map(it => current.rect.x - it.rect.x - it.rect.width))
}

async function copyContent(text) {
    try {
        await navigator.clipboard.writeText(text);
        console.log('Content copied to clipboard');
        /* Resolved - 文本被成功复制到剪贴板 */
    } catch (err) {
        console.error('Failed to copy: ', err);
        /* Rejected - 文本未被复制到剪贴板 */
    }
}

const targetNode = document.getElementById('screen')
const config = { childList: true, subtree: true };

const s = new MutationObserver((mutationList, observer) => {
    rebind()
})
s.observe(targetNode, config) 
rebind()
