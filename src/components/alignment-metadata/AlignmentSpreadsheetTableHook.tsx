/**
 * Base hook for pure webgl alignment details.
 */
import React, { useCallback, useMemo, useRef, useState } from "react";

import { 
  VirtualizedMatrixViewer 
} from "../virtualization/VirtualizedMatrixViewerHook";
import { 
  generateUUIDv4, 
  startEndIdxToArray 
} from "../../common/Utils";
import {
  IControllerRole,
  IResponderRole,
  IVirtualizeParams,
  IVirtualizedMatrixContent, 
  ScrollbarOptions, 
  VirtualizationRole, 
  VirtualizationStrategy 
} from "../virtualization/VirtualizationTypes";
import { ISpreadsheetColumn } from "./AlignmentSpreadsheetHook";
import { useResizeGrid } from "../layout/ResizeGridHook";

export interface IAlignmentSpreadsheetTableProps {
  alignmentUUID: string;
  columns: {[key: string]: ISpreadsheetColumn};
  columnKeys: string[];
  columnWidths: number[];
  fullActualWidth: number;
  rowHeight: number;
  className: string;
  vertVirtualization: IControllerRole | IResponderRole;
  vertScrollbar?: ScrollbarOptions;
  horizScrollbar?: ScrollbarOptions;

  columnWidthUpdateRequested: (colKey: string, newWidth?: number) => void;
  leftRightMarginInTableCells: number;
  resizeBarSizePx: number;

  showHeader?: boolean;
}

export function AlignmentSpreadsheetTable(props: IAlignmentSpreadsheetTableProps){

  const {
    alignmentUUID,
    className,
    columns,
    columnKeys,
    columnWidths,
    columnWidthUpdateRequested,
    fullActualWidth,
    leftRightMarginInTableCells,
    rowHeight,
    resizeBarSizePx,
    showHeader,
    vertVirtualization,
    vertScrollbar = ScrollbarOptions.OnHoverWhenOverflowed,
    horizScrollbar = ScrollbarOptions.OnHoverWhenOverflowed
  } = props;

  const HEADER_HEIGHT = 20;

  const headerRef = useRef<HTMLDivElement>(null);
  const containerId = useState<string>(generateUUIDv4()); //unique id for virtualization

  //generate horizontal virtualizations.
  const horizControllerVirtParams = useMemo(()=>{
    const params = {
      virtualizationStrategy: VirtualizationStrategy.Virtualize,
      scrollbar: horizScrollbar,
      hoverTracker: undefined,

      //account for header in the scrolled indicator shadow
      startScrolledIndicatorStyleAttr: {top: `-${HEADER_HEIGHT}px`},
      endScrolledIndicatorStyleAttr: {top: `-${HEADER_HEIGHT}}px`},
    }
    return {
      ...{
        virtualizationId: 
          `x_auto_generated_spreadsheet_virtualization_${alignmentUUID}_${containerId}`,
        role: VirtualizationRole.Controller,
        cellCount: 1,
        cellSizePx: fullActualWidth,
      } as IControllerRole,
      ...params
    }
  }, [
    alignmentUUID,
    containerId,
    fullActualWidth,
    horizScrollbar
  ]);

  const vertVirtParams = useMemo(()=>{
    const additionalParams = {
      virtualizationStrategy: VirtualizationStrategy.Manual,//VirtualizationStrategy.Virtualize,
      scrollbar: vertScrollbar,//.OnHoverWhenOverflowed,
      hoverTracker: "both" as const,
      overflowVisible: true, //override default hiding of overflow and deal with manually.
    };
    return { ...vertVirtualization, ...additionalParams };
  }, [
    vertVirtualization,
    vertScrollbar
  ]);


  const draggerMoved = useCallback((newX: number, key: string)=>{

    const idx = columnKeys.indexOf(key);
    const headerElems = headerRef.current?.getElementsByClassName("column-header");
    if(!headerElems || headerElems.length < idx){
      console.error(
        `Unable to resize - resizableElement does not exist for "${key}"`
      );
      return;
    }

    const boundingBox = headerElems[idx].getBoundingClientRect();
    const newProposedWidth = (
      newX - 
      (resizeBarSizePx/2) -      //center of resize element
      boundingBox.x              //actual offset of grid
    );

    columnWidthUpdateRequested(key, newProposedWidth);
  }, [
    resizeBarSizePx,
    columnKeys,
    columnWidthUpdateRequested
  ]);

  const resizerDoubleClicked = useCallback((key: string) => {
    columnWidthUpdateRequested(key)
  }, [ columnWidthUpdateRequested ]);

  const gridAreaResizerNames = useMemo(()=>{
    return columnKeys.map((colKey)=>{
      return `${colKey}-resizer`
    });
  }, [columnKeys]);

  const colResizers = useResizeGrid({
    resizeSeparatorGridAreaNames: gridAreaResizerNames,
    keys: columnKeys,
    resizeDirection: "horizontal",
    draggerMoved: draggerMoved,
    resizerDoubleClicked: resizerDoubleClicked
  });

  return (
    <>
      {colResizers.draggerFullScreenElement}
        <VirtualizedMatrixViewer 
          getMatrixContent={(params: IVirtualizedMatrixContent) => {
            const rows = startEndIdxToArray(
              params.firstRowIdxToRender, params.lastRowIdxToRender
            );

            const headerDivs = columnKeys.map((colKey, idx) => {
              return (
                <React.Fragment key={idx}>
                  <div 
                    className="column-header"
                    style={{
                      gridArea: colKey,
                      margin: `0 ${leftRightMarginInTableCells}px`,
                    }}>
                    {columns[colKey].initialColumnName}
                  </div>
                  {colResizers.resizeSeparators[colKey]}
                </React.Fragment>
              )
            });

            const contentDivs = columnKeys.map((colKey, colIdx) => {
              const data = columns[colKey].rawData;
              return (
                <React.Fragment key={colIdx}>
                  <div className="table-column" style={{
                    gridArea: colKey,
                    gridAutoRows: `${rowHeight}px`,
                    margin: `0 ${leftRightMarginInTableCells}px`,
                  }}>
                    { 
                      rows.map((rowIdx)=>{ 
                        return <div key={rowIdx}>{data[rowIdx]}</div> 
                      }) 
                    }
                  </div>
                  
                  {colResizers.resizeSeparators[colKey]}
                </React.Fragment>
              )
            });

            return (
              <>
                <div className={`${className} header`} ref={headerRef} style={{
                  //display: !showHeader ? "none" : undefined,
                  top: `-${HEADER_HEIGHT}px`,
                  height: `${HEADER_HEIGHT}px`,
                  lineHeight: `${HEADER_HEIGHT}px`,
                  gridTemplateColumns: `${columnWidths.map((width)=>{
                    return `${width}px ${resizeBarSizePx}px`
                  }).join(" ")}`,
                  gridTemplateAreas: `"${columnKeys.map((key)=>{
                    return `${key} ${key}-resizer`
                  }).join(" ")}"`
                }}>  {headerDivs} </div>

                <div className="content-holder">
                  <div className={`${className} content`} style={{
                    top: `${params.renderShiftTopPx}px`, 
                    gridTemplateColumns: `${columnWidths.map((width)=>{
                      return `${width}px ${resizeBarSizePx}px`
                    }).join(" ")}`,
                    gridTemplateAreas: `"${columnKeys.map((key)=>{
                      return `${key} ${key}-resizer`
                    }).join(" ")}"`
                  }}> {contentDivs} </div>
                </div>
              </>
            )
          }} 
          horizontalParams={horizControllerVirtParams} 
          verticalParams={vertVirtParams}          
        />
    </>
  )
}
