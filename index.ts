/*
 * Copyright 2018 Fluence Labs Limited
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

import "bootstrap/dist/css/bootstrap.min.css";
import * as fluence from "fluence";
import {AppSession, Result} from "fluence";

/**
 * A status info of one node of a real-time cluster.
 */
interface Status {
    addr: string,
    block_hash: string,
    app_hash: string,
    block_height: number
}

class DbClient {

    // sessions for every member of a cluster
    readonly appSession: AppSession;

    constructor(session: fluence.AppSession) {
        this.appSession = session;
    }

    /**
     * Submits queries to the real-time cluster and waits for a result.
     * @param queries list of queries to request
     */
    async submitQuery(queries: string[]): Promise<Promise<Result>[]> {
        return queries.map((q) => {
            console.log("query: " + q);
            let res = this.appSession.request(q).result();
            res.then((r: Result) => {
                return r.asString()
            });
            return res;
        });
    }

    /**
     * Gets status of all nodes.
     */
    async status(): Promise<any[]> {
        return this.appSession.getWorkersStatus()
    }
}

let updating = false;

let btn = document.getElementById("submitQuery") as HTMLButtonElement;
let updateStatusBtn = document.getElementById("updateStatus") as HTMLButtonElement;
let resultField: HTMLTextAreaElement = window.document.getElementById("result") as HTMLTextAreaElement;
let inputField: HTMLInputElement = window.document.getElementById("query") as HTMLInputElement;
let statusField: HTMLTextAreaElement = window.document.getElementById("status") as HTMLTextAreaElement;
let startBtn = document.getElementById("start") as HTMLButtonElement;
let main = document.getElementById("main") as HTMLDivElement;
let init = document.getElementById("init") as HTMLFormElement;
let metamaskCheckbox = document.getElementById("use-metamask") as HTMLInputElement;
let metamaskWrapper = document.getElementById("use-metamask-div") as HTMLDivElement;
let contractAddress: HTMLInputElement = window.document.getElementById("contract-address") as HTMLInputElement;
let appId: HTMLInputElement = window.document.getElementById("app-id") as HTMLInputElement;
let privateKey: HTMLInputElement = window.document.getElementById("private-key") as HTMLInputElement;
let ethereumAddress: HTMLInputElement = window.document.getElementById("ethereum-address") as HTMLInputElement;
let showAppId: HTMLSpanElement = window.document.getElementById("show-app-id") as HTMLSpanElement;
let showPrivateKey: HTMLSpanElement = window.document.getElementById("show-private-key") as HTMLSpanElement;

const urlParams = new URLSearchParams(window.location.search);
const appIdFromParams = urlParams.get('appId');
if (appIdFromParams) {
    let pk = urlParams.get("privateKey");
    pk ? getValuesAndPrepare(appIdFromParams, pk) : getValuesAndPrepare(appIdFromParams);
}

function addEventForTips() {
    let examplesList = (document.getElementById("tips") as HTMLElement).getElementsByTagName("li");
    for (let li of examplesList) {
        li.style.textDecoration = "underline";
        li.style.cursor = "pointer";
        li.addEventListener("click", function() {
            if (inputField.value) {
                inputField.value = inputField.value + "\n" + this.innerHTML;
            } else {
                inputField.value = this.innerHTML;
            }
        });
    }
}

addEventForTips();


function genStatus(status: Status) {
    return `<div class="m-2 rounded border list-group-item-info p-2">
                <label class="text-dark ml-2 mb-0" style="font-size: 0.8rem">${status.addr}</label>
                <ul class="list-unstyled mb-0 ml-4" style="font-size: 0.7rem">
                    <li>height: ${status.block_height}</li>
                    <li>block_hash: ${status.block_hash}</li>
                    <li>app_hash: ${status.app_hash}</li>
                </ul>
            </div>`
}

function genErrorStatus(addr: string, error: string) {
    return `<div class="m-2 rounded border list-group-item-info p-2">
                <label class="text-dark ml-2 mb-0" style="font-size: 0.8rem">${addr}</label>
                <ul class="list-unstyled mb-0 ml-4" style="font-size: 0.7rem">
                    <li>error: ${error}</li>
                </ul>
            </div>`
}

function genGlobalError(error: any) {
    let errorMessage = "Unhandled error: \n " + error.message;
    statusField.innerHTML = `<div class="m-2 rounded border list-group-item-info p-2">                
                <span style="color: red;">${errorMessage}</span>               
            </div>`;
}

/**
 * Shortens string by getting only left and right part with given size.
 */
function shorten(str: string, size: number): string {
    return str.substring(0, size) + "..." + str.substring(str.length - size, str.length);
}

let newLine = String.fromCharCode(13, 10);
let sep = "**************************";

async function preparePage(contractAddress: string, appId: string, ethereumAddress?: string, privateKey?: string) {
    init.hidden = true;
    main.hidden = false;

    showAppId.innerHTML = appId;
    showPrivateKey.innerHTML = privateKey ? "defined" : "undefined";

    let sessions = await fluence.connect(contractAddress, appId, ethereumAddress, privateKey);

    let client = new DbClient(sessions);

    function updateStatus() {
        if (updating) return;
        updating = true;
        client.status().then((r) => {
            statusField.innerHTML = r.map((resp) => {
                let info = resp.result;
                let addr = info.node_info.listen_addr;
                // if there is a response from a node

                let syncInfo = info.sync_info;
                let status: Status = {
                    addr: addr,
                    block_hash: shorten(syncInfo.latest_block_hash as string, 10),
                    app_hash: shorten(syncInfo.latest_app_hash as string, 10),
                    block_height: syncInfo.latest_block_height as number
                };
                return genStatus(status)
            }).join("\n");
        }).catch((e) => genErrorStatus(e.apiAddr + ":" + e.apiPort, e)).finally(() => updating = false)
    }

    // send request with query to a cluster
    function submitQueries(queries: string) {
        resultField.value = "";
        client.submitQuery(queries.split('\n')).then((results) => {
            results.forEach((pr) => {
                pr.then((r) => {
                    let strRes = r.asString().replace('\\n', newLine);
                    resultField.value += sep + newLine + strRes + newLine + sep;
                });

            });

        })
    }

    btn.addEventListener("click", () => {
        if (inputField.value.length !== 0) {
            submitQueries(inputField.value);
            inputField.value = "";
        }
    });

    //updates status of nodes every one second
    let timer = setInterval(updateStatus, 500);

    //stops or starts the timer for status updates
    updateStatusBtn.addEventListener("click", () => {
        let stop = "Stop update status";
        let start = "Start update status";
        if (updateStatusBtn.value === stop) {
            clearInterval(timer);
            updateStatusBtn.value = start;
        } else {
            timer = setInterval(updateStatus, 500);
            updateStatusBtn.value = stop;
        }

    });
}

function getValuesAndPrepare(appIdStr: string, privateKey?: string) {
    if (contractAddress.value && appIdStr && ethereumAddress.value) {
        let ethUrl = metamaskCheckbox.checked ? undefined : ethereumAddress.value;
        preparePage(contractAddress.value, appIdStr, ethUrl, privateKey).catch((e) => {
            console.log(e);
            genGlobalError(e);
        });
    } else {
        contractAddress.reportValidity();
        appId.reportValidity();
        ethereumAddress.reportValidity();
    }
}

startBtn.addEventListener("click", () => {
    let privateKeyStr: string | undefined;
    if (privateKey.value) {
        privateKeyStr = privateKey.value
    }
    getValuesAndPrepare(appId.value, privateKeyStr);
});

window.addEventListener('load', function() {

    let web3 = (window as any).web3;

    // Check if Web3 has been injected by the browser (Mist/MetaMask).
    if (typeof web3 === 'undefined') {
        metamaskWrapper.hidden = true;
    } else {
        metamaskCheckbox.addEventListener( 'change', function() {
            ethereumAddress.disabled = this.checked;
        });
    }
});

console.log(`

Please note that this is a shared instance of the SQL DB, and data may be altered by other users.

You can find docs at https://fluence.dev

Check out http://dash.fluence.network to deploy your own SQL DB instance
Check out http://sql.fluence.network to play with your data via web interface
Check out https://github.com/fluence/tutorials for more Fluence examples

If you have any questions, feel free to join our Discord https://fluence.chat :)


`)