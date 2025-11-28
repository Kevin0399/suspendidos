// ================================
// Macros


// ================================
const MAXMARCOS = 48; // Numero maximo de marcos

// Las siguientes constantes representan el indice de cada elemetno dentro de su respecticvo arreglo en la memoria
// memoria[0][0] === memoria[0][idMarcos], memoria[0][1] === memoria[0][estadoMarco]
const idMarco = 0;
const estadoMarco = 1;
const idProceso = 2;
const unidadesOcupadas = 3;




// ================================
// Variables globales
// ================================
let procesos = []; // Todos los procesos generados
let nuevos = []; // Cola de procesos en estado Nuevo
let listos = []; // Cola de procesos Listos
let bloqueados = []; // Cola de procesos Bloqueados
let terminados = []; // Procesos que ya terminaron
let enMemoria = []; // Procesos en memoria
let procesoEnEjecucion = null; // Proceso que esta en CPU
let relojGlobal = -1; // Tiempo global de simulacion
let intervalo = null; // Intervalo principal de simulacion
let pausado = false; // Pausa de la simulacion
let numProcesos = 0; // Cantidad total de procesos
let idContador = 1; // Contador para asignar IDs unicos
let contTerminados = 0; // Contador de cuantos procesos han terminado
let terminadoError = false;
let bcp = false; // Bandera para mostrar el BCP
let quantum = 0; // Tamaño del quantum
let quantumCumplido = false; // Bandera para indicar cuadno un proceso ha cumplido su quantum
let procesoInterrumpido = null; // Almacena el proceso interrumpido(se completo su quantum)

let memoria = []; // Arreglo que represetna la memoria y el estado de esta
let marcosLibres = []; // Arreglo que indica que marcos se encuentrean libres/disponibles
let relacionMP = []; // Indica en cuales marcos se encuentra un proceso
let espacio = true;  // Indica si hay espacio en la memoria

let suspendidos = [] // Arreglo que almacena los procesos suspendidos


// Inicializamos la memoria
const iniciarMemoria = () => {
    let paginasUsadas = []; // Almacena las paginas que se van a asignar al proceso
    for (let i = 0; i < MAXMARCOS; i++) {
        // El arreglo consta de los siguientes elementos 
        // id del marco / estado (0 => libre, 1 => ocupado) / id del proceso / numero de espacios del marco ocupados
        memoria[i] = [i, 0, 'N/A', 0];
        marcosLibres.push(i);
    }

    // Indicamos los marcos que estan ocupados por el so
    for (let i = 0; i < 4; i++) {
        memoria[i][estadoMarco] = 1;
        memoria[i][idProceso] = -1;
        memoria[i][unidadesOcupadas] = 5;
        marcosLibres.shift(); // Eliminamos los marcos que ya no estan libres
        paginasUsadas.push(i);
    }
    relacionMP.push([-1, paginasUsadas, 20]); // Añadimos la relacion proceso-marcos
    // Crear la representación visual de la memoria en el DOM
    crearUIdeMemoria();
    actualizarUIdeMemoria();
};


// ================================
// Interfaz Visual de Memoria (DOM)
// ================================
// Crea la estructura DOM con los 48 marcos y 5 slots por marco.
const crearUIdeMemoria = () => {
    const cont = document.getElementById('memoriaContainer');
    if (!cont) return; // Si no existe el contenedor, salir
    cont.innerHTML = ''; // Limpiar cualquier elemento previo

    // Forzamos dos columnas (pares izquierdo/derecho) para presentar marcos verticalmente
    cont.classList.add('memoriaContainer');

    for (let i = 0; i < MAXMARCOS; i++) {
        const marco = document.createElement('div');
        marco.className = 'marco';
        marco.dataset.marcoIndex = i;

        // ID del marco (a la izquierda)
        const idDiv = document.createElement('div');
        idDiv.className = 'marco-id';
        // Si memoria ya está inicializada, mostrar el id desde `memoria`.
        idDiv.innerText = (memoria[i] && memoria[i][idMarco] !== undefined) ? memoria[i][idMarco] : i;

        // Contenedor de los 5 slots verticales
        const slots = document.createElement('div');
        slots.className = 'marco-slots';

        for (let s = 0; s < 5; s++) {
            const slot = document.createElement('div');
            slot.className = 'slot';
            slot.dataset.marco = i;
            slot.dataset.slot = s;
            slots.appendChild(slot);
        }

        marco.appendChild(idDiv);
        marco.appendChild(slots);
        cont.appendChild(marco);
    }

    // Leyenda (colores)
    const legend = document.getElementById('memoriaLegend');
    if (legend) {
        legend.innerHTML = `
            <div class="legend-item"><div class="legend-color legend-ocupado"></div> Listo</div>
            <div class="legend-item"><div class="legend-color legend-ejecucion"></div> En Ejecución</div>
            <div class="legend-item"><div class="legend-color legend-bloqueado"></div> Bloqueado</div>
            <div class="legend-item"><div class="legend-color legend-so"></div> Sistema Operativo</div>
            <div class="legend-item"><div class="legend-color legend-libre"></div> Libre</div>
        `;
    }

    // Detalle auxiliar (info al hacer hover / click)
    let detalles = document.getElementById('memoriaDetails');
    if (!detalles) {
        detalles = document.createElement('div');
        detalles.id = 'memoriaDetails';
        const wrapper = document.getElementById('memoriaWrapper') || document.body;
        wrapper.appendChild(detalles);
    }
};


// Actualiza la UI de memoria según el array `memoria`.
const actualizarUIdeMemoria = () => {
    const cont = document.getElementById('memoriaContainer');
    if (!cont) return;

    for (let i = 0; i < MAXMARCOS; i++) {
        const marco = cont.children[i];
        if (!marco) continue;
        const idDiv = marco.querySelector('.marco-id');
        const slots = marco.querySelectorAll('.slot');

        // Actualizar ID (por si cambia)
        if (memoria[i] && memoria[i][idMarco] !== undefined) idDiv.innerHTML = `Marco: ${memoria[i][idMarco]} <br><br> Proceso: ${memoria[i][idProceso]}`;

        // Estado del marco (ocupado o libre)
        const estaOcupado = memoria[i] && memoria[i][estadoMarco] === 1;
        if (estaOcupado) marco.classList.add('ocupado'); else marco.classList.remove('ocupado');

        // Numero de espacios usados en el marco
        const ocupados = (memoria[i] && Number.isInteger(memoria[i][unidadesOcupadas])) ? memoria[i][unidadesOcupadas] : 0;

        // Id del proceso que ocupa el marco
        const pid = memoria[i] ? memoria[i][idProceso] : 'N/A';

        // Obtener el estado del proceso (Listo, Ejecucion, Bloqueado, SO)
        const proc = buscarProcesoPorId(pid);
        const estadoProc = proc ? proc.estado : (pid === -1 ? 'SO' : null);

        // Clasificar la clase para los slots ocupados
        let claseSlotOcupado = 'ocupado';
        if (estadoProc === 'Ejecucion') claseSlotOcupado = 'ejecucion';
        else if (estadoProc === 'Bloqueado') claseSlotOcupado = 'bloqueado';
        else if (pid === -1 || estadoProc === 'SO') claseSlotOcupado = 'so';

        // Aplicar clases a los primeros `ocupados` slots
        for (let s = 0; s < slots.length; s++) {
            const slot = slots[s];
            // Limpiar clases de estado
            slot.classList.remove('ocupado', 'so', 'bloqueado', 'ejecucion');

            if (s < ocupados && estaOcupado) {
                slot.classList.add(claseSlotOcupado);
            } else {
                // Dejar slots libres con la clase base (sin color)
            }
        }
    }
};


// buscarProcesoPorId: intenta localizar un proceso (por su id) en las
// diferentes estructuras donde puede estar (enMemoria, listos, bloqueados,
// terminados, nuevos) o actualmente en ejecución. Devuelve el objeto proceso
// o `null` si no se encuentra.
const buscarProcesoPorId = (id) => {
    if (id === 'N/A' || id === undefined || id === null) return null;
    if (id === -1) return { id: -1, op: 'SO', estado: 'SO' };
    const listas = [enMemoria, listos, bloqueados, terminados, nuevos];
    for (const l of listas) {
        if (!Array.isArray(l)) continue;
        for (const p of l) {
            if (p && p.id === id) return p;
        }
    }
    if (procesoEnEjecucion && procesoEnEjecucion.id === id) return procesoEnEjecucion;
    if (procesoInterrumpido && procesoInterrumpido.id === id) return procesoInterrumpido;
    return null;
}

const ingresarMarco = (p) => {
    let paginasUsadas = [];

    if (marcosLibres.length >= p.numPaginas) {
        for (let i = 0; i < p.numPaginas; i++) {
            if (i == p.numPaginas - 1) {

                memoria[marcosLibres[i]][estadoMarco] = 1;
                memoria[marcosLibres[i]][idProceso] = p.id;
                memoria[marcosLibres[i]][unidadesOcupadas] = p.tamanio - ((p.numPaginas - 1) * 5);
                paginasUsadas.push(marcosLibres[i]);
            }
            else {

                memoria[marcosLibres[i]][estadoMarco] = 1;
                memoria[marcosLibres[i]][idProceso] = p.id;
                memoria[marcosLibres[i]][unidadesOcupadas] = 5;
                paginasUsadas.push(marcosLibres[i]);
            }
        }
        const usadasSet = new Set(paginasUsadas);
        for (let i = marcosLibres.length - 1; i >= 0; i--) {
            if (usadasSet.has(marcosLibres[i])) {
                marcosLibres.splice(i, 1);
            }
        }

        relacionMP.push([p.id, paginasUsadas, p.tamanio]);
        return 1;
    }
    return 0;
};

const retirarProceso = (p) => {
    let procesoRetirar = buscarEnMemoria(p.id);
    let paginasLiberar = procesoRetirar[0];
    let idEliminar = procesoRetirar[1];
    paginasLiberar.forEach(e => {
        marcosLibres.push(e);
        memoria[e][estadoMarco] = 0;
        memoria[e][idProceso] = 'N/A';
        memoria[e][unidadesOcupadas] = 0;
    });

    if (idEliminar !== -1) {

        relacionMP.splice(idEliminar, 1);
    }
    espacio = true;
};

const buscarEnMemoria = (id) => {
    for (let i = 0; i < relacionMP.length; i++) {
        if (id == relacionMP[i][0]) {
            console.log(relacionMP[i][1])
            return [relacionMP[i][1], i];
        }
    }
    return [];
};


const paginarProceso = (p) => {
    let num = p.tamanio / 5;
    let parteEntera = Math.floor(num);
    p.numPaginas = parteEntera < num ? parteEntera + 1 : parteEntera;
};


// ================================
// Fase Inicial -> crear procesos
// ================================
document.getElementById("btnIniciar").addEventListener("click", () => {

    iniciarMemoria();

    const cantidad = parseInt(document.getElementById("numProcesos").value);
    const tamanioQtm = parseInt(document.getElementById('quantum').value);

    if (isNaN(cantidad) || cantidad <= 0) {
        alert("Por favor ingresa un numero valido de procesos");
        return;
    }

    if (isNaN(tamanioQtm) || tamanioQtm <= 0) {
        alert("Por favor ingresa un numero valido de quantum");
        return;
    }
    numProcesos = cantidad;
    quantum = tamanioQtm;
    generarProcesos(numProcesos);

    // Pasar de Fase Inicial a Fase Ejecucion
    document.getElementById("faseInicial").style.display = "none";
    document.getElementById("faseEjecucion").style.display = "block";
    document.getElementById("pantallaBcp").style.display = "none";
    document.getElementById("faseResultados").style.display = "none";

    // Iniciar el tick cada segundo
    if (!intervalo) intervalo = setInterval(tick, 1000);
});

// ================================
// Generar procesos aleatorios
// ================================
const generarProcesos = (n) => {
    for (let i = 0; i < n; i++) {
        const tiempoMax = Math.floor(Math.random() * 15) + 6; // TME entre 6 y 20
        const tamanioMax = Math.floor(Math.random() * 25) + 6; // TM entre 6 y 30
        let a = Math.floor(Math.random() * 10) + 1;
        let b = Math.floor(Math.random() * 10) + 1;
        let ops = ["+", "-", "*", "/", "%"];
        let op = ops[Math.floor(Math.random() * ops.length)];

        // Evitar division entre cero
        if ((op === "/" || op === "%") && b === 0) b = 1;

        // Crear objeto proceso
        const proceso = {
            id: idContador++,
            op: `${a} ${op} ${b}`,
            a,
            b,
            operador: op,
            tiempoMax,
            tiempoTrans: 0,
            estado: "Nuevo",
            llegada: null,
            finalizacion: null,
            retorno: null,
            respuesta: null,
            espera: 0,
            servicio: 0,
            resultado: null,
            error: false,
            bloqueadoRestante: 0,
            quantumTrans: 0,
            tamanio: tamanioMax,
            numPaginas: 0
        };
        nuevos.push(proceso);
    }
    render(); // Actualizar pantalla
}

// ================================
// Bucle principal de la simulacion
// ================================
const tick = () => {

    if (pausado) return;

    // Incrementar reloj global del ciclo
    relojGlobal++;

    // Si se cumplio un quantum, colocamos el proceso interrumpido al final de listos
    if (quantumCumplido) {
        listos[listos.length] = procesoInterrumpido;
        procesoInterrumpido = null;
        quantumCumplido = false;
    }

    while (nuevos.length > 0 && espacio) {
        let proc = nuevos.shift();
        paginarProceso(proc);
        if (proc.numPaginas <= marcosLibres.length) {
            proc.estado = 'Listo';
            proc.llegada = relojGlobal; // Guardamos el tiempo en el que el proceso llego
            listos.push(proc);
            enMemoria.push(proc); // Guardamos los procesos en memoria
            ingresarMarco(proc);
        }
        else {
            nuevos.unshift(proc);
            espacio = false;
        }
    }

    // Si no hay proceso en ejecucion, tomar el siguiente de listos
    if (!procesoEnEjecucion && listos.length > 0) {
        procesoEnEjecucion = listos.shift();
        procesoEnEjecucion.estado = "Ejecucion";

        // Registramos el tiempo de respuesta
        if (procesoEnEjecucion.respuesta === null) {
            procesoEnEjecucion.respuesta = relojGlobal - procesoEnEjecucion.llegada;   // Determinado el tiempo mediante la formula
        }

        // Marcar primer tick en CPU para no incrementar tiempoTrans todavía
        procesoEnEjecucion._nuevoEnCPU = true;
    }

    // Ejecutar el proceso actual
    if (procesoEnEjecucion) {
        if (procesoEnEjecucion._nuevoEnCPU) {
            procesoEnEjecucion._nuevoEnCPU = false; // No incrementar en primer tick
        } else {
            procesoEnEjecucion.tiempoTrans++;
            procesoEnEjecucion.servicio++;
            procesoEnEjecucion.quantumTrans++;
        }
        // Si el proceso ha cumplido su tiempo
        if (procesoEnEjecucion.tiempoTrans >= procesoEnEjecucion.tiempoMax) {
            finalizarProceso(procesoEnEjecucion);
            procesoEnEjecucion = null; // Declaramos que ya no hay proceso en ejecucion
        }
    }

    // Si el proceso finalizo debido a un error
    if (terminadoError) {
        finalizarProceso(procesoEnEjecucion);
        procesoEnEjecucion = null;
        terminadoError = false;
    }

    // Si se cumple el periodo del quantum 
    if (procesoEnEjecucion && procesoEnEjecucion.quantumTrans >= quantum && listos.length > 0) {
        procesoEnEjecucion.estado = "Listo";
        quantumCumplido = true; // Indicamos que se ha cumplido el quantum
        procesoEnEjecucion.quantumTrans = 0; // Reiniciamos el tiempo de quantum transcurrido
        procesoInterrumpido = procesoEnEjecucion;
        procesoEnEjecucion = null;
    }

    // Actualizar bloqueados
    bloqueados.forEach((p, idx) => {
        p.bloqueadoRestante--;
        if (p.bloqueadoRestante < 0) {
            p.estado = "Listo";
            p.quantumTrans = 0; // Reiniciamos su quantum transcurrido
            listos.push(p);
            bloqueados.splice(idx, 1);
        }
    });



    // Verificar si todos los procesos terminaron
    if (terminados.length === numProcesos) {
        clearInterval(intervalo);
        intervalo = null;
        let btnResultados = document.createElement('button');
        btnResultados.innerText = "Ver Resultados";
        document.getElementById('btnVerResultados').appendChild(btnResultados);
        btnResultados.addEventListener(`click`, () => {
            mostrarResultados();
        });
    }

    // Actualizar los procesos en memoria
    enMemoria = []; // Limpiamos el arreglo
    let indice = 0;


    // Incluimos el proceso en ejecucion
    if (procesoEnEjecucion) {
        enMemoria[indice] = procesoEnEjecucion; // Añadimos el proceso en ejecucion
        indice++;
    }

    // Incluimos los procesos en "listos"
    listos.forEach(p => {
        enMemoria[indice++] = p; // Añadimos los procesos listos

    });

    // Si se interrumpio un proceso, este se agrega la final de "listos"
    if (procesoInterrumpido) {
        enMemoria[indice] = procesoInterrumpido; // Añadimos el proceso en ejecucion
        indice++;
    }

    // Incluimos los procesos bloqueados
    if (indice < 4) {
        bloqueados.forEach(p => {
            enMemoria[indice++] = p; // Añadimos los procesos bloqeuados
        });
    }



    render(); // Actualizar pantalla


}

// ================================
// Finalizar proceso (normal o error)
// ================================
const finalizarProceso = (p) => {
    p.estado = "Terminado";
    p.finalizacion = relojGlobal;
    p.retorno = p.finalizacion - p.llegada;
    p.espera = p.retorno - p.servicio;

    try {
        if (!p.error) p.resultado = eval(p.op); // Evaluar operacion
        else p.resultado = "ERROR";
    } catch {
        p.resultado = "ERROR"; // Captura cualquier error de operacion
    }

    terminados.push(p);
    retirarProceso(p);
    console.log({ relacionMP })
}

// ================================
// Manejo de teclas: E, W, P, C
// ================================
document.addEventListener("keydown", (e) => {
    const tecla = e.key.toUpperCase();

    // Si estamos en pausa, solo permitir C para continuar
    if (pausado && tecla !== "C") return; // Ignorar otras teclas mientras esta en pausa

    if (tecla === "E" && procesoEnEjecucion) {
        // Mandar proceso a bloqueados por E/S
        procesoEnEjecucion.estado = "Bloqueado";
        procesoEnEjecucion.bloqueadoRestante = 8; // 8 seg
        bloqueados.push(procesoEnEjecucion);
        procesoEnEjecucion = null;
    } else if (tecla === "W" && procesoEnEjecucion) {
        // Terminar proceso por error
        procesoEnEjecucion.error = true;
        terminadoError = true;
        // finalizarProceso(procesoEnEjecucion);
        // procesoEnEjecucion = null;
    } else if (tecla === "P") {
        pausado = true; // Pausar simulacion
    } else if (tecla === "C") {
        pausado = false; // Continuar simulacion
        document.getElementById("faseEjecucion").style.display = "block";
        document.getElementById("pantallaBcp").style.display = "none";
        document.getElementById("pantallaTabla").style.display = "none";
    } else if (tecla === "N") {
        const nuevoProceso = generarProcesoUnico();
        nuevos.push(nuevoProceso);
        numProcesos++; // Aumenta el conteo total esperado
        render();
    } else if (tecla === "B") {
        pausado = true;
        document.getElementById("faseEjecucion").style.display = "none";
        document.getElementById("pantallaBcp").style.display = "block";
        mostrarBCP();
    } else if (tecla === "T") {
        pausado = true;
        document.getElementById("faseEjecucion").style.display = "none";
        document.getElementById("pantallaTabla").style.display = "flex";
        document.getElementById('pantallaTabla').classList.add('pantallaTabla');
        mostrarTablaPg();
    }
    else if (tecla === "S") {
        // Si hay procesos bloqueados
        if (bloqueados.length > 0) {
            bloqueados[0].estado = 'Suspendido';
            retirarProceso(bloqueados[0]); // Retiramos el proceso de la memoria
            suspendidos.push(bloqueados.shift()); // Suspendemos el proceso bloqueado 
            console.log("Suspendidos: ", suspendidos);
        }
    }
    else if (tecla === "R") {
        let regreso = 0
        // Si hay procesos suspendidos
        if (suspendidos.length > 0) {
            if (espacio) {
                let suspendido = suspendidos[0];
                regreso = ingresarMarco(suspendido);
                if (regreso === 1) {
                    suspendido.estado = 'Listo';
                    listos.push(suspendido);
                    enMemoria.push(suspendido); // Guardamos el proceso en memoria
                    suspendidos.shift();
                }

                console.log("Suspendidos: ", suspendidos);
            }
        }
    }
});

const mostrarTablaPg = () => {
    document.getElementById("relojTabla").innerText = `Reloj: ${relojGlobal}`;
    let html = "<tr><th>ID-Proceso</th><th>Tamaño del Proceso</th><th>Paginas Asociadas</th></tr>";
    relacionMP.forEach(p => {
        if (relacionMP.length > 0) {
            if (p[0] === -1) {
                html += `<tr>
                <td> Sistema Operativo </td>
                <td> ${p[2]} </td>
                <td>${p[1]}</td> </tr>`;
            }
            else {
                html += `<tr>
            <td> ${p[0]} </td>
                <td>${p[2]}
                <td>${p[1]}</td> </tr>`;
            }
        }
    });

    // Formatear los marcos libres en varias líneas dentro de la misma celda
    const chunkArray = (arr, size) => {
        const res = [];
        for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
        return res;
    };

    // Agrupar en líneas de hasta 8 marcos por línea para evitar una única línea muy larga
    const lines = chunkArray(marcosLibres, 8).map(line => line.join(', ')).join('<br/>');

    // Contenedor con ancho máximo y ajuste de palabra para que no ensanche la tabla
    const marcosCell = `<div style="max-width:220px; white-space:normal; word-break:break-word; overflow-wrap:break-word;">${lines || '-'}</div>`;

    let html2 = `
        <tr>
            <th>Cantidad de Marcos Libres</th>
            <th>Espacio Disponible</th>
            <th>Marcos</th>
        </tr>
        <tr>
            <td>${marcosLibres.length}</td>
            <td>${marcosLibres.length * 5}</td>
            <td>${marcosCell}</td>
        </tr>

    `;


    let htmlBloqPg = "<tr><th>ID-Proceso</th><th>Tamaño del Proceso</th><th>Paginas Asociadas</th><th>T. Rest. Bloq.</th></tr>";
    bloqueados.forEach(p => {
        if (bloqueados.length > 0) {
            htmlBloqPg += `<tr>
            <td> ${p.id} </td>
            <td>${p.tamanio} </td>
            <td>${p.numPaginas} </td>
            <td>${p.bloqueadoRestante} </td>
        `;
        }
    });



    document.getElementById('tablaPg').innerHTML = html;
    document.getElementById('tablaPgLibres').innerHTML = html2;
    document.getElementById('tablaPgBloq').innerHTML = htmlBloqPg;
};

const mostrarBCP = () => {
    document.getElementById("relojBCP").innerText = `Reloj: ${relojGlobal}`;
    let html = "<tr><th>ID</th><th>Operacion</th><th>Resultado</th><th>TME</th><th>Llegada</th><th>Finalización</th><th>Espera</th><th>Respuesta</th><th>Retorno</th><th>Servicio</th><th>Restante</th><th>Estado</th></tr>";
    terminados.forEach(p => {
        html += `<tr>
            <td>${p.id}</td>
            <td>${p.op}</td>
            <td>${p.resultado}</td>
            <td>${p.tiempoMax}</td>
            <td>${p.llegada}</td>
            <td>${p.finalizacion}</td>
            <td>${p.espera}</td>
            <td>${p.respuesta}</td>
            <td>-</td>
            <td>${p.servicio}</td>
            <td>${"0"}</td>
            <td>${p.estado}</td>
        </tr>`;
    });
    // Incluimos los procesos de memoria
    enMemoria.forEach(p => {
        let respuestaParcial = (p.respuesta == null) ? "-" : p.respuesta; // Evaluamos si el proceso ya cuenta con un tiempo de respuesta
        let esperaParcial = (relojGlobal - p.llegada) - p.tiempoTrans; // Calculamos el tiempo que ha esperado el proceso 
        let restante = p.tiempoMax - p.tiempoTrans;               // Calculamos el tiempo restante del proceso  
        html += `<tr>
            <td>${p.id}</td>
            <td>${p.op}</td>
            <td>${"-"}</td>
            <td>${p.tiempoMax}</td>
            <td>${p.llegada}</td>
            <td>${"-"}</td>
            <td>${esperaParcial}</td>
            <td>${respuestaParcial}</td>
            <td>-</td>
            <td>${p.tiempoTrans}</td>
            <td>${restante}</td>
            <td>${p.estado}</td>
        </tr>`;
    })
    document.getElementById("bcp").innerHTML = html + `<button type="button" id="btnContinuar"> Continuar  </button>`;
    let continuar = document.getElementById('btnContinuar');


    continuar.addEventListener("click", () => {
        pausado = false;
        document.getElementById("faseEjecucion").style.display = "block";
        document.getElementById("pantallaBcp").style.display = "none";
    });
}

// ================================
// Función para crear un solo proceso aleatorio (Nuevo proceso)
// ================================
const generarProcesoUnico = () => {
    const tiempoMax = Math.floor(Math.random() * 15) + 6;
    const tamanioMax = Math.floor(Math.random() * 25) + 6; // TM entre 6 y 30
    let a = Math.floor(Math.random() * 10) + 1;
    let b = Math.floor(Math.random() * 10) + 1;
    let ops = ["+", "-", "*", "/", "%"];
    let op = ops[Math.floor(Math.random() * ops.length)];
    if ((op === "/" || op === "%") && b === 0) b = 1;

    const proceso = {
        id: idContador++,
        op: `${a} ${op} ${b}`,
        a,
        b,
        operador: op,
        tiempoMax,
        tiempoTrans: 0,
        estado: "Nuevo",
        llegada: null,
        finalizacion: null,
        retorno: null,
        respuesta: null,
        espera: 0,
        servicio: 0,
        resultado: null,
        error: false,
        bloqueadoRestante: 0,
        quantumTrans: 0,
        tamanio: tamanioMax,
        numPaginas: 0

    };
    return proceso;
};

// ================================
// Renderizar en pantalla
// ================================
const render = () => {
    document.getElementById("reloj").innerText = `Reloj: ${relojGlobal}`;
    document.getElementById("nuevos").innerText = nuevos.length;
    document.getElementById("tiempoQuantum").innerText = quantum;
    let proc = nuevos[0] ? nuevos[0] : { id: 'N/A', tamanio: 'N/A', numPaginas: 'N/A' };
    document.getElementById("proceso-a-listos").innerText = `Siguiente proceso a Listos: ID: ${proc.id} Tamaño: ${proc.tamanio} Paginas: ${proc.numPaginas} `;

    // Mostrar tabla de Listos
    let htmlListos = "<tr><th>ID</th><th>TME</th><th>Trans</th></tr>";
    listos.forEach(p => {
        htmlListos += `<tr><td>${p.id}</td><td>${p.tiempoMax}</td><td>${p.tiempoTrans}</td></tr>`;
    });
    document.getElementById("tablaListos").innerHTML = htmlListos;

    let mensajeCPU = "";

    const procesosEnMemoria = listos.length + bloqueados.length + (procesoEnEjecucion ? 1 : 0);

    if (procesoEnEjecucion) {
        // Proceso normal en ejecución
        mensajeCPU = `
        <p>ID: ${procesoEnEjecucion.id}</p>
        <p>Operacion: ${procesoEnEjecucion.op}</p>
        <p>Trans: ${procesoEnEjecucion.tiempoTrans}</p>
        <p>Quantum: ${procesoEnEjecucion.quantumTrans}</p>
        <p>Restante: ${procesoEnEjecucion.tiempoMax - procesoEnEjecucion.tiempoTrans}</p>
        <p>Restante: ${procesoEnEjecucion.tamanio}</p>
        <p>Restante: ${procesoEnEjecucion.numPaginas}</p>
    `;
    } else if ((procesosEnMemoria > 0 && listos.length === 0 && bloqueados.length === procesosEnMemoria) || (procesosEnMemoria <= 0)) {
        // Todos los procesos en memoria están bloqueados → Proceso nulo
        mensajeCPU = "CPU: Proceso nulo";
    } else {
        // CPU libre (no hay procesos en memoria listos ni bloqueados)
        mensajeCPU = "Cambio de Contexto";
    }

    document.getElementById("ejecucion").innerHTML = mensajeCPU;


    // Mostrar tabla de Bloqueados
    let htmlBloq = "<tr><th>ID</th><th>Tiempo Bloq Rest</th></tr>";
    bloqueados.forEach(p => {
        htmlBloq += `<tr><td>${p.id}</td><td>${p.bloqueadoRestante}</td></tr>`;
    });
    document.getElementById("tablaBloqueados").innerHTML = htmlBloq;

    // Mostrar tabla de Suspendidos
    let htmlSusp = "<tr><th>ID</th><th>Tamaño</th><th>Paginas</th></tr>";
    suspendidos.forEach(p => {
        htmlSusp += `<tr><td>${p.id}</td><td>${p.tamanio}</td><td>${p.numPaginas}</td></tr>`;
    });
    document.getElementById("tablaSuspendidos").innerHTML = htmlSusp;

    // Mostrar tabla de Terminados
    let htmlTerm = "<tr><th>ID</th><th>Operacion</th><th>Resultado</th></tr>";
    terminados.forEach(p => {
        htmlTerm += `<tr><td>${p.id}</td><td>${p.op}</td><td>${p.resultado}</td></tr>`;
    });
    document.getElementById("tablaTerminados").innerHTML = htmlTerm;

    // Ajustar la altura de la caja de ejecución para que no salte
    try {
        // Medir la altura del contenido real de las tablas (no de los wrappers flex que pueden
        // verse afectados por la altura de la caja de ejecución y generar un ciclo de crecimiento).
        const tableListos = document.getElementById('tablaListos');
        const tableTerm = document.getElementById('tablaTerminados');
        const ejecWrapper = document.querySelector('.mostrarEjecucion');
        if (tableListos && tableTerm && ejecWrapper) {
            const h1 = tableListos.scrollHeight || tableListos.getBoundingClientRect().height;
            const h2 = tableTerm.scrollHeight || tableTerm.getBoundingClientRect().height;
            // Añadimos un padding visual para que la caja de ejecución tenga espacio suficiente
            const padding = 40;
            const maxH = Math.max(h1, h2, 80) + padding; // mínimo razonable + padding
            ejecWrapper.style.minHeight = `${maxH}px`;
        }
    } catch (e) {
        // Silenciar errores de layout en entornos no DOM
        console.warn('Error ajustando alturas de contenedorEstados:', e);
    }

    // Actualizar la vista de memoria (48 marcos x 5 slots)
    try { actualizarUIdeMemoria(); } catch (e) { /* Entorno sin DOM o error silencioso */ }

}

// ================================
// Mostrar resultados finales
// ================================
const mostrarResultados = () => {
    // Ocultar fase Ejecucion y mostrar Resultados
    document.getElementById("faseEjecucion").style.display = "none";
    document.getElementById("faseResultados").style.display = "block";

    // Crear tabla con todas las mediciones de cada proceso
    let html = "<tr><th>ID</th><th>Llegada</th><th>Final</th><th>Retorno</th><th>Respuesta</th><th>Espera</th><th>Servicio</th><th>Resultado</th></tr>";
    terminados.forEach(p => {
        html += `<tr>
            <td>${p.id}</td>
            <td>${p.llegada}</td>
            <td>${p.finalizacion}</td>
            <td>${p.retorno}</td>
            <td>${p.respuesta}</td>
            <td>${p.espera}</td>
            <td>${p.servicio}</td>
            <td>${p.resultado}</td>
        </tr>`;
    });
    document.getElementById("tablaResultados").innerHTML = html + `<button type="button" id="btnFinalizar"> Finalizar  </button>`;

    let finalizar = document.getElementById('btnFinalizar');
    finalizar.addEventListener('click', () => {
        location.reload();
    })
}