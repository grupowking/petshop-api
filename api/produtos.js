// api/produtos.js - Arquivo principal da API
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { produto, categoria } = req.query;
    
    if (!produto) {
      return res.status(400).json({ 
        error: 'Parâmetro "produto" é obrigatório' 
      });
    }

    // ID da sua planilha
    const SHEET_ID = '1zlQvAqQjI7mjjiyGCyJwvT8RzW7aj6itwnY25ILcv9w';
    
    // Categorias disponíveis (conforme as abas da planilha)
    const categorias = ['ACESSORIO', 'HIGIENE', 'INSUMO', 'PERFUMARIA', 'PISCINA', 'racao', 'REMEDIO', 'VENENO'];
    
    let resultados = [];

    // Se categoria específica foi informada, busca só nela
    if (categoria && categorias.includes(categoria)) {
      const dados = await buscarNaCategoria(SHEET_ID, categoria, produto);
      resultados = dados;
    } else {
      // Busca em todas as categorias
      for (const cat of categorias) {
        const dados = await buscarNaCategoria(SHEET_ID, cat, produto);
        resultados = [...resultados, ...dados];
      }
    }

    // Ordenar por relevância (nome mais similar primeiro)
    resultados.sort((a, b) => {
      const scoreA = calcularSimilaridade(produto.toLowerCase(), a.nome.toLowerCase());
      const scoreB = calcularSimilaridade(produto.toLowerCase(), b.nome.toLowerCase());
      return scoreB - scoreA;
    });

    if (resultados.length === 0) {
      return res.status(404).json({
        message: 'Produto não encontrado',
        sugestao: 'Verifique a grafia ou tente termos mais genéricos'
      });
    }

    res.status(200).json({
      total: resultados.length,
      produtos: resultados.slice(0, 10) // Limita a 10 resultados
    });

  } catch (error) {
    console.error('Erro na API:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message 
    });
  }
}

// Função para buscar produtos em uma categoria específica
async function buscarNaCategoria(sheetId, categoria, termoBusca) {
  try {
    // URL para acessar a planilha como CSV
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${categoria}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Erro ao acessar planilha: ${response.status}`);
    }
    
    const csvText = await response.text();
    const linhas = csvText.split('\n');
    
    if (linhas.length < 2) {
      return [];
    }

    const produtos = [];
    
    // Parse das linhas de dados (pula o cabeçalho)
    for (let i = 1; i < linhas.length; i++) {
      const linha = linhas[i];
      if (!linha.trim()) continue;
      
      const colunas = parsearCSVLinha(linha);
      
      if (colunas.length < 3) continue; // Precisa ter pelo menos NOME, CATEGORIA, PREÇO
      
      // Extrai os dados das colunas (NOME, CATEGORIA, PREÇO)
      const nome = colunas[0] ? colunas[0].replace(/"/g, '').trim() : '';
      const categoriaCol = colunas[1] ? colunas[1].replace(/"/g, '').trim() : '';
      const preco = colunas[2] ? colunas[2].replace(/"/g, '').trim() : '';
      
      // Verifica se o produto contém o termo de busca
      if (nome && contem(nome, termoBusca)) {
        produtos.push({
          nome: nome,
          categoria: categoria,
          preco: preco || 'Consulte',
          estoque: 'Disponível',
          marca: '',
          descricao: ''
        });
      }
    }
    
    return produtos;
    
  } catch (error) {
    console.error(`Erro ao buscar em ${categoria}:`, error);
    return [];
  }
}

// Função para fazer parse de linha CSV (lida com vírgulas dentro de aspas)
function parsearCSVLinha(linha) {
  const resultado = [];
  let atual = '';
  let dentroAspas = false;
  
  for (let i = 0; i < linha.length; i++) {
    const char = linha[i];
    
    if (char === '"') {
      dentroAspas = !dentroAspas;
    } else if (char === ',' && !dentroAspas) {
      resultado.push(atual.trim());
      atual = '';
    } else {
      atual += char;
    }
  }
  
  resultado.push(atual.trim());
  return resultado;
}

// Função para verificar se uma string contém outra (busca inteligente)
function contem(texto, busca) {
  const textoLimpo = removerAcentos(texto.toLowerCase());
  const buscaLimpa = removerAcentos(busca.toLowerCase());
  
  // Busca exata
  if (textoLimpo.includes(buscaLimpa)) {
    return true;
  }
  
  // Busca por palavras individuais
  const palavrasBusca = buscaLimpa.split(' ');
  return palavrasBusca.some(palavra => 
    palavra.length > 2 && textoLimpo.includes(palavra)
  );
}

// Função para calcular similaridade entre strings
function calcularSimilaridade(str1, str2) {
  if (str1 === str2) return 1;
  if (str1.includes(str2) || str2.includes(str1)) return 0.8;
  
  const palavras1 = str1.split(' ');
  const palavras2 = str2.split(' ');
  
  let matches = 0;
  palavras1.forEach(p1 => {
    if (palavras2.some(p2 => p1.includes(p2) || p2.includes(p1))) {
      matches++;
    }
  });
  
  return matches / Math.max(palavras1.length, palavras2.length);
}

// Função para remover acentos
function removerAcentos(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}